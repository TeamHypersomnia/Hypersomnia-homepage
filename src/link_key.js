const crypto = require('crypto');
const express = require('express');
const { makeLimiter, wideLimitKey } = require('./limiter');
const { clientIp } = require('./client_ip');
const db = require('./db');
const config = require('./config');

/*
  Linking an identity key (the account of a player without Steam, "key_<public key in hex>")
  to a Steam account, so that the progress from ranked matches played with the key counts towards the Steam account.

  1. The game opens /link_key/start with its random state; signed in through Steam, the player's browser brings
     a one-time code back to the game (createCode) - to its listener on 127.0.0.1, or to the web build's tab.
  2. The game asks GET /link_key/info?code=<code> whose Steam account it is (name and avatar, shown while linking).
  3. The game signs "hypersomnia-link-v1 <code> <steam account>" with the key and sends it to /link_key/link.
  4. A valid signature with a valid code links the key as a child of that Steam account.

  The code ties the link to the Steam session that asked for it, and the signature proves the key and
  which Steam account the player agreed to, so nobody can link someone else's key, or link their own key
  to someone else's Steam account. A key linked to one Steam account is not moved to another in the browser -
  it has to be unlinked there first (the Steam build's signed ticket does move it - see linkBySteamTicket).
*/

const router = express.Router();

// The web build of the game runs on another origin. These need no cookies - the key's signature is the proof.
router.use(['/info', '/link', '/unlink'], (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
  }

  next();
});

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_LIFETIME_MS = 5 * 60 * 1000;
const MAX_KEYS_PER_STEAM_ACCOUNT = 32;
const MAX_LIVE_CODES_PER_ACCOUNT = 4;

// code -> { steamId, steamName, expires }; one live code per Steam account
const codes = new Map();

function removeExpired(now) {
  for (const [code, entry] of codes) {
    if (entry.expires <= now) codes.delete(code);
  }
}

function createCode(steamId, steamName) {
  const now = Date.now();
  removeExpired(now);

  // A few devices may link at once - the oldest of this account's codes goes first (a Map keeps the order of insertion)
  const own = [...codes].filter(([, entry]) => entry.steamId === steamId).map(([code]) => code);

  for (const code of own.slice(0, Math.max(0, own.length - (MAX_LIVE_CODES_PER_ACCOUNT - 1)))) {
    codes.delete(code);
  }

  let code = '';

  for (let i = 0; i < CODE_LENGTH; ++i) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }

  codes.set(code, { steamId, steamName, expires: now + CODE_LIFETIME_MS });
  return code;
}

function liveCode(code) {
  const entry = codes.get(code);
  return entry && entry.expires > Date.now() ? entry : null;
}

// Guessing codes with one's own key would link it to someone else's Steam account
// Guessing an 8 letter code at 10 a minute is hopeless; no total - 60 addresses could use it up for everyone.
// A whole /24 or /48 has a limit of its own.
const allowAttemptPerAddress = makeLimiter({ perAddress: 10 });
const allowAttemptPerNetwork = makeLimiter({ perAddress: 100, keyOf: wideLimitKey });
const allowAttempt = ip => allowAttemptPerNetwork(ip) && allowAttemptPerAddress(ip);

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
  setLinkMeta: db.prepare('INSERT OR REPLACE INTO key_links (child_id, linked_via, device, last_cert_at, os) VALUES (?, ?, ?, ?, ?)'),
  touchKey: db.prepare('UPDATE key_links SET last_cert_at = ?, device = COALESCE(?, device), os = COALESCE(?, os) WHERE child_id = ?'),
  oldestSteamBuildKey: db.prepare(`
    SELECT a.child_id FROM associations a JOIN key_links m ON m.child_id = a.child_id
    WHERE a.parent_id = ? AND m.linked_via = 'steam' ORDER BY COALESCE(m.last_cert_at, 0) LIMIT 1
  `),
  linkMetaOf: db.prepare('SELECT linked_via, device, last_cert_at, os FROM key_links WHERE child_id = ?'),
  ban: db.prepare('INSERT OR IGNORE INTO broker_bans (account, reason) VALUES (?, ?)')
};

/*
  The newest unlink timestamp taken per key - a signed unlink seen once (e.g. in a log) can not be sent again.
  In memory: after a restart the 10 minute window still bounds it.
*/
const lastUnlinkTimestamp = new Map();

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

function validCode(code) {
  return typeof code === 'string' && /^[A-Z0-9]{8}$/.test(code.toUpperCase());
}

// Whose Steam account a code links to, for the game to show before the player agrees - with its avatar (base64), as /cert has it
router.get('/info', async (req, res) => {
  const ip = clientIp(req);

  if (!allowAttempt(ip)) {
    return res.status(429).send('Too many attempts. Try again in a minute.');
  }

  const { code } = req.query;

  if (!validCode(code)) {
    return res.status(400).send('Invalid request.');
  }

  const entry = liveCode(code.toUpperCase());

  if (!entry) {
    return res.status(404).send('The link took too long (over 5 minutes). Click Link with Steam... in the game again.');
  }

  // Required here: broker.js requires this file
  const { accountProfile } = require('./broker');
  const profile = await accountProfile(entry.steamId, ip, Date.now() + 4000).catch(() => null);
  const avatar = profile && profile.avatar ? Buffer.from(profile.avatar).toString('base64') : '';

  res.json({ steam_id: entry.steamId, name: entry.steamName || '', avatar });
});

function link(params, ip, res) {
  if (!allowAttempt(ip)) {
    return res.status(429).send('Too many attempts. Try again in a minute.');
  }

  const { public_key, code, signature } = params || {};

  if (typeof public_key !== 'string' || !/^[0-9a-f]{64}$/.test(public_key)
    || typeof signature !== 'string' || !/^[0-9a-f]{128}$/.test(signature)
    || !validCode(code)
  ) {
    return res.status(400).send('Invalid request.');
  }

  const normalizedCode = code.toUpperCase();
  const entry = liveCode(normalizedCode);

  // The cheap check first: no signature verification for guessed codes
  if (!entry) {
    return res.status(401).send('The link took too long (over 5 minutes). Click Link with Steam... in the game again.');
  }

  if (!verifySignature(public_key, `hypersomnia-link-v1 ${normalizedCode} ${entry.steamId}`, signature)) {
    return res.status(401).send('Invalid signature.');
  }

  const child = `key_${public_key}`;

  try {
    if (stmts.banned.get(child)) {
      return res.status(403).send('This key is banned.');
    }

    if (stmts.banned.get(entry.steamId)) {
      return res.status(403).send('This Steam account is banned.');
    }

    const parent = stmts.parentOf.get(child);

    // The code stays valid, so it can be used once the key is unlinked from the other account
    if (parent && parent.parent_id !== entry.steamId) {
      return res.status(409).send('This key is already linked to another Steam account. Unlink it there first.');
    }

    // Every new device or browser is a new key: many are fine, an endless stream is not
    if (!parent && linkedKeys(entry.steamId).length >= MAX_KEYS_PER_STEAM_ACCOUNT) {
      return res.status(409).send(`This Steam account already has ${MAX_KEYS_PER_STEAM_ACCOUNT} keys linked.\nUnlink the ones you no longer use.`);
    }

    const { device, os } = deviceOf(params);

    // Linked to this account already (e.g. by the Steam build): its link stays as it is
    if (!parent) {
      db.transaction(() => {
        stmts.link.run(child, entry.steamId);
        moveProgressIfFirst(child, entry.steamId);
        stmts.setLinkMeta.run(child, 'browser', device, Math.floor(Date.now() / 1000), os);
      })();
    }
    else {
      touchKey(child, device, os);
    }
  } catch (err) {
    // The code stays usable - nothing was linked
    console.error(`[link_key] Could not link ${child}:`, err && err.message ? err.message : err);
    return res.status(503).type('text/plain').send('Could not link right now. Try again in a moment.');
  }

  // Single use: a code is gone once it linked a key
  codes.delete(normalizedCode);

  console.log(`[link_key] Linked ${child} to ${entry.steamId}.`);

  res.json({ linked: child, to: entry.steamId });
}

/*
  Progress on linking: the key's ranked progress in a mode moves to the Steam account only if that account has no matches
  in that mode yet - otherwise it stays with the key, to be seen on its profile. Never merged.
*/
function moveProgressIfFirst(child, steamId) {
  for (const table of ['mmr_team', 'mmr_ffa']) {
    const own = db.prepare(`SELECT * FROM ${table} WHERE account_id = ?`).get(child);
    if (!own) continue;

    const steam = db.prepare(`SELECT matches_won, matches_lost FROM ${table} WHERE account_id = ?`).get(steamId);
    if (steam && (steam.matches_won + steam.matches_lost) > 0) continue;

    db.prepare(`DELETE FROM ${table} WHERE account_id = ?`).run(steamId);
    db.prepare(`UPDATE ${table} SET account_id = ? WHERE account_id = ?`).run(steamId, child);
    db.prepare('INSERT OR REPLACE INTO progress_moves (child_id, parent_id, table_name, matches_after_move) VALUES (?, ?, ?, ?)')
      .run(child, steamId, table, own.matches_won + own.matches_lost);
    console.log(`[link_key] Moved the ${table} progress of ${child} to ${steamId}.`);
  }
}

/*
  Every unlink - by the key's signature or by the Steam account on /profile: the progress the key brought goes back to it
  (see moveProgressBack), and a key does not get out of its Steam account's ban by leaving it.
  A key let go at the limit (progressBack false) leaves its progress where it is: it is not played on anymore.
*/
function unlinkKey(child, steamId, { progressBack = true } = {}) {
  db.transaction(() => {
    // Not this account's key (e.g. anyone's key posted to /profile/unlink_key): nothing else may be touched - not its
    // progress moves, not its link, and above all no ban of this account carried over to it
    if (stmts.unlink.run(child, steamId).changes === 0) {
      return;
    }

    if (progressBack) {
      moveProgressBack(child, steamId);
    }
    else {
      db.prepare('DELETE FROM progress_moves WHERE child_id = ? AND parent_id = ?').run(child, steamId);
    }

    db.prepare('DELETE FROM key_links WHERE child_id = ?').run(child);

    const parentBan = stmts.banned.get(steamId);

    if (parentBan) {
      stmts.ban.run(child, parentBan.reason || 'Banned.');
    }
  })();
}

/*
  The key unlinking itself (e.g. linked with a code that was not the player's) takes back the progress it brought -
  as long as the Steam account has played no match since, so nobody's own matches are taken.
*/
function moveProgressBack(child, steamId) {
  const moves = db.prepare('SELECT table_name, matches_after_move FROM progress_moves WHERE child_id = ? AND parent_id = ?').all(child, steamId);

  for (const move of moves) {
    const table = move.table_name;

    if (table !== 'mmr_team' && table !== 'mmr_ffa') continue;

    const steam = db.prepare(`SELECT matches_won, matches_lost FROM ${table} WHERE account_id = ?`).get(steamId);
    const own = db.prepare(`SELECT 1 FROM ${table} WHERE account_id = ?`).get(child);

    if (steam && !own && steam.matches_won + steam.matches_lost === move.matches_after_move) {
      db.prepare(`UPDATE ${table} SET account_id = ? WHERE account_id = ?`).run(child, steamId);
      console.log(`[link_key] Moved the ${table} progress of ${child} back from ${steamId}.`);
    }
  }

  db.prepare('DELETE FROM progress_moves WHERE child_id = ? AND parent_id = ?').run(child, steamId);
}

// The web build can only make GET requests
router.get('/link', (req, res) => link(req.query, clientIp(req), res));

/*
  "Link with Steam": the game opens /link_key/start?state=<its random state> in the browser.
  Signed in through Steam (here, or on the way), the player gets a code that goes back to the game - only ever to
  the game itself, with the game's state, which the game checks:
  - the native game: &port=<port> - to the game's listener on http://127.0.0.1:<port> (loopback redirect, RFC 8252);
  - the web build: to LINK_RETURN_URL, which hands it to the game's tab.
  A link to this page someone else made leads to their state - the game of whoever opens it does not take it.
*/
function startParams(query) {
  const { state, port } = query || {};

  if (typeof state !== 'string' || !/^[0-9a-f]{32}$/.test(state)) {
    return null;
  }

  const loopbackPort = port === undefined || port === '' ? null : Number(port);

  if (loopbackPort !== null && !(Number.isInteger(loopbackPort) && loopbackPort >= 1024 && loopbackPort <= 65535)) {
    return null;
  }

  return { state, loopbackPort, path: loopbackPort !== null ? `/link_key/start?state=${state}&port=${loopbackPort}` : `/link_key/start?state=${state}` };
}

/*
  Signed in already, the player confirms which Steam account to link to: on a shared browser the session may be
  someone else's. The code is made only by this page's POST (a cross-site form does not carry the session cookie).
*/
router.get('/start', (req, res) => {
  const params = startParams(req.query);

  if (!params) {
    return res.status(400).send('Invalid request.');
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
    port: params.loopbackPort === null ? '' : String(params.loopbackPort)
  });
});

router.post('/start', (req, res) => {
  const params = startParams(req.body);

  if (!params || !req.user) {
    return res.status(400).send('Invalid request. Start again from the game: Settings - Account - Link with Steam.');
  }

  const code = createCode(`steam_${req.user.id}`, req.user.displayName);
  res.set('Cache-Control', 'no-store');

  if (params.loopbackPort !== null) {
    return res.redirect(303, `http://127.0.0.1:${params.loopbackPort}/linked?code=${code}&state=${params.state}`);
  }

  res.redirect(303, `${config.LINK_RETURN_URL}#code=${code}&state=${params.state}`);
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
  Unlinking from the game, signed with the key - for a player who linked it to a Steam account that is not theirs
  (e.g. a code someone gave them) and can not sign in there. The signed timestamp must be within 10 minutes.
*/
// Its own limit, without the overall one - nothing to guess here, and a flood of code guesses must not block it
const allowUnlink = makeLimiter({ perAddress: 10 });

function unlinkBySignature(params, ip, res) {
  if (!allowUnlink(ip)) {
    return res.status(429).send('Too many attempts. Try again in a minute.');
  }

  const { public_key, signature, timestamp: written_timestamp } = params || {};
  const timestamp = typeof written_timestamp === 'string' ? Number(written_timestamp) : written_timestamp;

  if (typeof public_key !== 'string' || !/^[0-9a-f]{64}$/.test(public_key)
    || typeof signature !== 'string' || !/^[0-9a-f]{128}$/.test(signature)
    || !Number.isSafeInteger(timestamp)
  ) {
    return res.status(400).send('Invalid request.');
  }

  if (Math.abs(Date.now() / 1000 - timestamp) > 10 * 60) {
    return res.status(401).send('The clock of this computer is off. Set it right and try again.');
  }

  if (!verifySignature(public_key, `hypersomnia-unlink-v1 ${public_key} ${timestamp}`, signature)) {
    return res.status(401).send('Invalid signature.');
  }

  const child = `key_${public_key}`;

  if (timestamp <= (lastUnlinkTimestamp.get(child) || 0)) {
    return res.status(401).send('This unlink was already used. Try again.');
  }

  const parent = (() => {
    try {
      const found = stmts.parentOf.get(child);

      if (found) {
        unlinkKey(child, found.parent_id);
      }

      return found || null;
    } catch (err) {
      console.error(`[link_key] Could not unlink ${child}:`, err && err.message ? err.message : err);
      return undefined;
    }
  })();

  // Taken only once it unlinked - a retry of a failed one is not "already used"
  if (parent === undefined) {
    return res.status(503).type('text/plain').send('Could not unlink right now. Try again in a moment.');
  }

  // Bounded: the oldest entries go first (the 10 minute window still bounds a replay of those)
  if (lastUnlinkTimestamp.size > 100000) {
    lastUnlinkTimestamp.delete(lastUnlinkTimestamp.keys().next().value);
  }

  lastUnlinkTimestamp.set(child, timestamp);

  if (!parent) {
    return res.json({ unlinked: child, from: null });
  }

  console.log(`[link_key] Unlinked ${child} from ${parent.parent_id} by its own signature.`);

  res.json({ unlinked: child, from: parent.parent_id });
}

router.get('/unlink', (req, res) => unlinkBySignature(req.query, clientIp(req), res));

/*
  The Steam build links its key by the ticket it shows /cert once (see broker.js) - from then on the key's signature
  is enough, as for a key linked in the browser. A key linked to another account goes over to the ticket's one;
  at the limit, the account's Steam build key unused for the longest is let go - so the Steam build never hits it.
*/
function linkBySteamTicket(child, steamId, device, os = null) {
  const now = Math.floor(Date.now() / 1000);

  db.transaction(() => {
    if (stmts.banned.get(child)) {
      return;
    }

    const parent = stmts.parentOf.get(child);

    // Already this account's: only when and where - a key linked in the browser stays one (never let go at the limit)
    if (parent && parent.parent_id === steamId) {
      if (linkMetaOf(child)) {
        touchKey(child, device, os);
      }
      else {
        stmts.setLinkMeta.run(child, 'steam', device, now, os);
      }

      return;
    }

    // At the limit, which key makes room - decided before the key leaves its old account, so it never ends up nowhere
    const oldest = linkedKeys(steamId).length >= MAX_KEYS_PER_STEAM_ACCOUNT ? stmts.oldestSteamBuildKey.get(steamId) : null;

    if (linkedKeys(steamId).length >= MAX_KEYS_PER_STEAM_ACCOUNT && !oldest) {
      // Only keys linked in the browser - the Steam build plays on without linking (by its ticket)
      return;
    }

    if (parent) {
      unlinkKey(child, parent.parent_id);
    }

    if (oldest) {
      unlinkKey(oldest.child_id, steamId, { progressBack: false });
      console.log(`[link_key] Let go of ${oldest.child_id} (the Steam build key of ${steamId} unused for the longest).`);
    }

    stmts.link.run(child, steamId);
    moveProgressIfFirst(child, steamId);
    stmts.setLinkMeta.run(child, 'steam', device, now, os);
    console.log(`[link_key] The Steam build linked ${child} to ${steamId}.`);
  })();
}

// A linked key got a cert by its signature: when, and the device the game named
function touchKey(child, device, os = null) {
  stmts.touchKey.run(Math.floor(Date.now() / 1000), device, os, child);
}

function linkMetaOf(child) {
  return stmts.linkMetaOf.get(child) || null;
}

module.exports = { router, deviceOf, linkedKeys, verifySignature, unlink: unlinkKey, linkBySteamTicket, touchKey, linkMetaOf };
