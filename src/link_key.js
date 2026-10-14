const crypto = require('crypto');
const express = require('express');
const { makeLimiter } = require('./limiter');
const { clientIp } = require('./client_ip');
const db = require('./db');
const config = require('./config');

/*
  Linking an identity key (the account of a player without Steam, "key_<public key in hex>")
  to a Steam account, so that the progress from ranked matches played with the key counts towards the Steam account.

  1. The game makes a random state, signs "hypersomnia-link-v1 <state> <unix time>" with the key and opens
     /link_key/start?state&t&key&sig (and the device it runs on, shown on the page) - good for LINK_URL_LIFETIME_SECS.
  2. Signed in through Steam, the player confirms the device and the Steam account there - the key is linked at once.
  3. The game, asking /link_key/result with its state, learns how it went.

  The signature proves the key's owner started it, the Steam session which account it goes to, so nobody can link
  someone else's key, or link their own key to someone else's Steam account (short of being sent a link and confirming
  it - the page warns). A key linked to one Steam account is not moved to another in the browser -
  it has to be unlinked there first. The Steam build never links its key - its certs come by a Steam ticket.
*/

const router = express.Router();

// The web build of the game runs on another origin. These need no cookies - the key's signature (for /result, the game's
// secret state) is the proof.
router.use(['/result'], (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
  }

  next();
});

const RESULT_LIFETIME_MS = 15 * 60 * 1000;
const MAX_KEYS_PER_STEAM_ACCOUNT = 32;
const MAX_LIVE_RESULTS_PER_ACCOUNT = 4;

// A raw 32-byte Ed25519 public key wrapped as SPKI DER, the form node:crypto takes
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/*
  OpenSSL (and so node:crypto) accepts the public keys of small order, for which a fixed signature verifies
  with any message - e.g. the key 01 00..00 with R = 01 00..00 and S = 0 - so anyone could link such an account.
  Rejected like libsodium does: those keys and such R (sign bit cleared), and the non-canonical keys.
  The same check as in the game (augs/misc/ed25519.cpp).
*/
const FF = 'ff'.repeat(30);
const SMALL_ORDER = [
  '00'.repeat(32),
  '01' + '00'.repeat(31),
  '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
  'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
  'ec' + FF + '7f',
  'ed' + FF + '7f',
  'ee' + FF + '7f'
];

function withoutSignBit(pointHex) {
  const bytes = Buffer.from(pointHex, 'hex');
  bytes[31] &= 0x7f;
  return bytes.toString('hex');
}

function hasSmallOrder(pointHex) {
  return SMALL_ORDER.includes(withoutSignBit(pointHex));
}

function isCanonical(pointHex) {
  const bytes = Buffer.from(withoutSignBit(pointHex), 'hex');

  if (bytes[31] !== 0x7f) return true;

  for (let i = 1; i < 31; ++i) {
    if (bytes[i] !== 0xff) return true;
  }

  return bytes[0] < 0xed;
}

function verifySignature(publicKeyHex, message, signatureHex) {
  if (!isCanonical(publicKeyHex) || hasSmallOrder(publicKeyHex) || hasSmallOrder(signatureHex.slice(0, 64))) {
    return false;
  }

  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]),
      format: 'der',
      type: 'spki'
    });

    const bytes = Buffer.isBuffer(message) ? message : Buffer.from(message, 'utf8');
    return crypto.verify(null, bytes, key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

const stmts = {
  link: db.prepare('INSERT OR IGNORE INTO associations (child_id, parent_id) VALUES (?, ?)'),
  parentOf: db.prepare('SELECT parent_id FROM associations WHERE child_id = ?'),
  unlink: db.prepare('DELETE FROM associations WHERE child_id = ? AND parent_id = ?'),
  linkedKeys: db.prepare("SELECT child_id FROM associations WHERE parent_id = ? AND child_id LIKE 'key_%' ORDER BY child_id"),
  banned: db.prepare('SELECT reason FROM broker_bans WHERE account = ?'),
  setLinkMeta: db.prepare('INSERT OR REPLACE INTO key_devices (child_id, device, os, last_cert_at) VALUES (?, ?, ?, ?)'),
  touchKey: db.prepare('UPDATE key_devices SET last_cert_at = ? WHERE child_id = ?'),
  linkMetaOf: db.prepare('SELECT device, os, last_cert_at FROM key_devices WHERE child_id = ?'),
  ban: db.prepare('INSERT OR IGNORE INTO broker_bans (account, reason) VALUES (?, ?)')
};


// The device the game runs on, as it names it, and its system - shown next to a linked key on its owner's /profile only
function deviceOf(query) {
  const device = typeof query.device === 'string'
    ? query.device.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 64) || null
    : null;

  const os = ['windows', 'linux', 'mac', 'web'].includes(query.os) ? query.os : null;

  return { device, os };
}

function linkedKeys(steamId) {
  return stmts.linkedKeys.all(steamId).map(row => row.child_id);
}

/*
  Links the key to the signed-in Steam account - a refusal is an { error, conflict } for the game to show.
*/
function linkKey(publicKey, steamId, device, os) {
  const child = `key_${publicKey}`;

  try {
    if (stmts.banned.get(child)) {
      return { error: 'This key is banned.' };
    }

    if (stmts.banned.get(steamId)) {
      return { error: 'This Steam account is banned.' };
    }

    const parent = stmts.parentOf.get(child);

    if (parent && parent.parent_id !== steamId) {
      return { error: 'This key is already linked to another Steam account. Unlink it there first.', conflict: true };
    }

    // Every new device or browser is a new key: many are fine, an endless stream is not
    if (!parent && linkedKeys(steamId).length >= MAX_KEYS_PER_STEAM_ACCOUNT) {
      return { error: `This Steam account already has ${MAX_KEYS_PER_STEAM_ACCOUNT} keys linked.\nUnlink the ones you no longer use.`, conflict: true };
    }

    if (!parent) {
      db.transaction(() => {
        stmts.link.run(child, steamId);
        moveProgressIfFirst(child, steamId);
        stmts.setLinkMeta.run(child, device, os, Math.floor(Date.now() / 1000));
      })();
    }
    else {
      // Linked to this account already: its link stays as it is
      touchKey(child);
    }
  } catch (err) {
    console.error(`[link_key] Could not link ${child}:`, err && err.message ? err.message : err);
    return { error: 'Could not link right now. Try again in a moment.' };
  }

  console.log(`[link_key] Linked ${child} to ${steamId}.`);
  return { linked: steamId };
}

/*
  Progress on linking: the key's ranked progress in a mode moves to the Steam account only if that account has no matches
  in that mode yet - otherwise it stays with the key, to be seen on its profile. Never merged, and never moved back on an unlink.
*/
function moveProgressIfFirst(child, steamId) {
  for (const table of ['mmr_team', 'mmr_ffa']) {
    const own = db.prepare(`SELECT * FROM ${table} WHERE account_id = ?`).get(child);
    if (!own) continue;

    // Any row of the Steam account is its progress - an FFA match (0:0) or a short one counts no wins nor losses
    const steam = db.prepare(`SELECT 1 FROM ${table} WHERE account_id = ?`).get(steamId);
    if (steam) continue;

    db.prepare(`UPDATE ${table} SET account_id = ? WHERE account_id = ?`).run(steamId, child);
    console.log(`[link_key] Moved the ${table} progress of ${child} to ${steamId}.`);
  }
}

/*
  Every unlink - by the key's signature or by the Steam account on /profile: only the link goes - the progress stays where it
  is - and a key does not get out of its Steam account's ban by leaving it.
*/
function unlinkKey(child, steamId) {
  db.transaction(() => {
    // Not this account's key (e.g. anyone's key posted to /profile/unlink_key): nothing else may be touched - not its
    // link, and above all no ban of this account carried over to it
    if (stmts.unlink.run(child, steamId).changes === 0) {
      return;
    }

    db.prepare('DELETE FROM key_devices WHERE child_id = ?').run(child);

    const parentBan = stmts.banned.get(steamId);

    if (parentBan) {
      stmts.ban.run(child, parentBan.reason || 'Banned.');
    }
  })();
}

/*
  "Link with Steam": the game opens /link_key/start?state&key&sig in the browser - nothing goes back through the browser,
  so it works the same natively, in a tab or in an iframe. A link to this page someone else made carries their key:
  confirmed, it would link their key to the Steam account of whoever confirmed - the page warns in red.
*/
// The game's state, its public key, its signature of the state and the device it runs on (shown on the confirm page)
function startParams(query) {
  const { state, t, key, sig } = query || {};

  if (typeof state !== 'string' || !/^[0-9a-f]{32}$/.test(state)
    || typeof t !== 'string' || !/^[0-9]{1,12}$/.test(t)
    || typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key)
    || typeof sig !== 'string' || !/^[0-9a-f]{128}$/.test(sig)
  ) {
    return null;
  }

  const { device, os } = deviceOf(query);
  const deviceQuery = (device ? `&device=${encodeURIComponent(device)}` : '') + (os ? `&os=${os}` : '');

  return { state, t, key, sig, device, os, path: `/link_key/start?state=${state}&t=${t}&key=${key}&sig=${sig}${deviceQuery}` };
}

function signedByKey(params) {
  return verifySignature(params.key, `hypersomnia-link-v1 ${params.state} ${params.t}`, params.sig);
}

/*
  A link page is good for a while only - one left in a browser's history (a shared computer, a stream) links nothing later.
  Some slack for a clock ahead.
*/
const LINK_URL_LIFETIME_SECS = 15 * 60;

function linkUrlExpired(params) {
  const age = Math.floor(Date.now() / 1000) - Number(params.t);
  return age > LINK_URL_LIFETIME_SECS || age < -10 * 60;
}

const expiredLink = 'This link is too old (or the clock of your computer is off). Start again in the game: Settings - Account - Link with Steam.';

/*
  How each state's link went, waiting for the game to fetch it (/link_key/result) - within RESULT_LIFETIME_MS.
  The state is the game's own random secret: nobody else can ask. At most MAX_LIVE_RESULTS_PER_ACCOUNT per Steam account.
*/
const resultsForStates = new Map();

function keepResult(state, steamId, result) {
  const now = Date.now();

  for (const [s, entry] of resultsForStates) {
    if (entry.expires <= now) resultsForStates.delete(s);
  }

  // A Map keeps the order of insertion - the account's oldest go first
  const own = [...resultsForStates].filter(([, entry]) => entry.steamId === steamId).map(([s]) => s);

  for (const s of own.slice(0, Math.max(0, own.length - (MAX_LIVE_RESULTS_PER_ACCOUNT - 1)))) {
    resultsForStates.delete(s);
  }

  resultsForStates.set(state, { steamId, result, expires: now + RESULT_LIFETIME_MS });
}

// A page saying what happened: linked (the game finishes it), or an error
function renderResult(res, status, ok, title, message) {
  res.status(status).render('link_result', { page: title, user: res.req.user, ok, title, message });
}

const invalidLink = 'This link is not valid. Start again in the game: Settings - Account - Link with Steam.';

/*
  Signed in already, the player confirms the device and which Steam account to link to: on a shared browser the session
  may be someone else's. The link is made only by this page's POST (a cross-site form does not carry the session cookie).
*/
router.get('/start', (req, res) => {
  const params = startParams(req.query);

  if (!params || !signedByKey(params)) {
    return renderResult(res, 400, false, 'Error', invalidLink);
  }

  if (linkUrlExpired(params)) {
    return renderResult(res, 400, false, 'Error', expiredLink);
  }

  if (!req.user) {
    req.session.after_login = params.path;
    return res.redirect('/auth/steam');
  }

  res.set('Cache-Control', 'no-store');

  res.render('link_confirm', {
    page: 'Link the game to Steam',
    user: req.user,
    steamName: req.user.displayName,
    steamId: req.user.id,
    state: params.state,
    key: params.key,
    sig: params.sig,
    t: params.t,
    device: params.device,
    os: params.os
  });
});

const allowStart = makeLimiter({ perAddress: 10 });

router.post('/start', (req, res) => {
  const params = startParams(req.body);

  res.set('Cache-Control', 'no-store');

  if (!allowStart(clientIp(req))) {
    return renderResult(res, 429, false, 'Error', 'Too many attempts. Try again in a minute.');
  }

  if (!params || !req.user || !signedByKey(params)) {
    return renderResult(res, 400, false, 'Error', invalidLink);
  }

  if (linkUrlExpired(params)) {
    return renderResult(res, 400, false, 'Error', expiredLink);
  }

  // A state links once - the same page sent again does nothing more
  if (resultsForStates.has(params.state)) {
    return renderResult(res, 409, false, 'Error', 'This link was used already. Start again in the game: Settings - Account - Link with Steam.');
  }

  const steamId = `steam_${req.user.id}`;
  const result = linkKey(params.key, steamId, params.device, params.os);

  keepResult(params.state, steamId, result);

  if (result.error) {
    return renderResult(res, result.conflict ? 409 : 403, false, 'Error', result.error);
  }

  renderResult(res, 200, true, 'You can go back to Hypersomnia', 'This tab can be closed now.');
});

/*
  The game, while its "Continue in your browser" waits, asks every second how the link for its state went:
  200 with {"linked": "steam_..."} or {"error", "conflict"} (the same until it expires), 204 until then.
  Its own limit - a whole linking is up to 300 asks in 5 minutes.
*/
const allowResult = makeLimiter({ perAddress: 120 });

router.get('/result', (req, res) => {
  res.set('Cache-Control', 'no-store');

  if (!allowResult(clientIp(req))) {
    return res.status(429).send('Too many attempts. Try again in a minute.');
  }

  const { state } = req.query;

  if (typeof state !== 'string' || !/^[0-9a-f]{32}$/.test(state)) {
    return res.status(400).send('Invalid request.');
  }

  const entry = resultsForStates.get(state);

  if (!entry || entry.expires <= Date.now()) {
    return res.status(204).end();
  }

  // The same answer until it expires - one lost on the way is asked for again
  res.json(entry.result);
});

// "Use a different Steam account": signed out, then the Steam sign-in, back to the same question
router.post('/start/switch', (req, res) => {
  const params = startParams(req.body);

  if (!params) {
    return res.status(400).send('Invalid request.');
  }

  req.logout(() => {
    req.session.after_login = params.path;
    res.redirect(303, '/auth/steam');
  });
});

/*
  "Unlink from Steam..." in the game: it opens /link_key/unlink?state&key (and the device) - signed in through Steam,
  the owner of the account the key is linked to unlinks it with one click, as on /profile; the game learns it from
  /link_key/result. Only that account can: a key linked to someone else's account is not theirs to unlink.
*/
function unlinkParams(query) {
  const { state, key } = query || {};

  if (typeof state !== 'string' || !/^[0-9a-f]{32}$/.test(state) || typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key)) {
    return null;
  }

  const { device, os } = deviceOf(query);
  const deviceQuery = (device ? `&device=${encodeURIComponent(device)}` : '') + (os ? `&os=${os}` : '');

  return { state, key, device, os, path: `/link_key/unlink?state=${state}&key=${key}${deviceQuery}` };
}

const invalidUnlink = 'This link is not valid. Start again in the game: Settings - Account - Link with Steam.';

// Linked to this Steam account? Otherwise the page says so - and to whose account it is linked, if the player's own
function notThisAccountsKey(key, steamId) {
  const parent = stmts.parentOf.get(`key_${key}`);

  if (!parent) {
    return 'This game key is not linked to any Steam account.';
  }

  if (parent.parent_id !== steamId) {
    return 'This game key is linked to another Steam account. Sign in there to unlink it.';
  }

  return null;
}

router.get('/unlink', (req, res) => {
  const params = unlinkParams(req.query);

  if (!params) {
    return renderResult(res, 400, false, 'Error', invalidUnlink);
  }

  if (!req.user) {
    req.session.after_login = params.path;
    return res.redirect('/auth/steam');
  }

  res.set('Cache-Control', 'no-store');

  const refusal = notThisAccountsKey(params.key, `steam_${req.user.id}`);

  if (refusal) {
    return renderResult(res, 409, false, 'Error', refusal);
  }

  res.render('link_confirm', {
    page: 'Unlink the game from Steam',
    user: req.user,
    steamName: req.user.displayName,
    steamId: req.user.id,
    unlink: true,
    state: params.state,
    key: params.key,
    sig: '',
    t: '',
    device: params.device,
    os: params.os
  });
});

const allowUnlink = makeLimiter({ perAddress: 10 });

router.post('/unlink', (req, res) => {
  const params = unlinkParams(req.body);

  res.set('Cache-Control', 'no-store');

  if (!allowUnlink(clientIp(req))) {
    return renderResult(res, 429, false, 'Error', 'Too many attempts. Try again in a minute.');
  }

  if (!params || !req.user) {
    return renderResult(res, 400, false, 'Error', invalidUnlink);
  }

  if (resultsForStates.has(params.state)) {
    return renderResult(res, 409, false, 'Error', 'This link was used already. Start again in the game: Settings - Account - Link with Steam.');
  }

  const steamId = `steam_${req.user.id}`;
  const refusal = notThisAccountsKey(params.key, steamId);

  if (refusal) {
    keepResult(params.state, steamId, { error: refusal });
    return renderResult(res, 409, false, 'Error', refusal);
  }

  try {
    unlinkKey(`key_${params.key}`, steamId);
  } catch (err) {
    console.error(`[link_key] Could not unlink key_${params.key}:`, err && err.message ? err.message : err);
    return renderResult(res, 503, false, 'Error', 'Could not unlink right now. Try again in a moment.');
  }

  console.log(`[link_key] Unlinked key_${params.key} from ${steamId} (from the game).`);

  keepResult(params.state, steamId, { unlinked: steamId });
  renderResult(res, 200, true, 'You can go back to Hypersomnia', 'The game key is unlinked. This tab can be closed now.');
});

// When a linked key last got a cert - its device and system are kept from the link
function touchKey(child) {
  stmts.touchKey.run(Math.floor(Date.now() / 1000), child);
}

function linkMetaOf(child) {
  return stmts.linkMetaOf.get(child) || null;
}

module.exports = { router, linkedKeys, verifySignature, unlink: unlinkKey, touchKey, linkMetaOf };
