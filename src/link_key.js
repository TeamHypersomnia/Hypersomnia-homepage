const crypto = require('crypto');
const express = require('express');
const { makeLimiter } = require('./limiter');
const { clientIp } = require('./client_ip');
const db = require('./db');
const config = require('./config');

/*
  Linking an identity key (the account of a player without Steam, "key_<public key in hex>")
  to a Steam account, so that the progress from ranked matches played with the key counts towards the Steam account.

  1. Signed in through Steam, the player sees a one-time code on /link (currentCode, createCode).
  2. The game asks GET /link_key/info?code=<code> whose Steam account it is and shows its name,
     so that a code someone else gave the player ("enter this for a badge") is seen for what it is.
  3. Confirmed, the game signs "hypersomnia-link-v1 <code> <steam account>" with the key and posts it to /link_key.
  4. A valid signature with a valid code links the key as a child of that Steam account.

  The code ties the link to the Steam session that asked for it, and the signature proves the key and
  which Steam account the player agreed to, so nobody can link someone else's key, or link their own key
  to someone else's Steam account. A key linked to one Steam account is not moved to another -
  it has to be unlinked there first.
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
const MAX_KEYS_PER_STEAM_ACCOUNT = 10;

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

  for (const [code, entry] of codes) {
    if (entry.steamId === steamId) codes.delete(code);
  }

  let code = '';

  for (let i = 0; i < CODE_LENGTH; ++i) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }

  codes.set(code, { steamId, steamName, expires: now + CODE_LIFETIME_MS });
  return code;
}

/*
  The code /link shows right away: this Steam account's live code while it has at least a few minutes left
  (reloading the page does not invalidate a code already typed into the game), a new one otherwise.
  The same code as from createCode - tied to this Steam session.
*/
const CODE_MIN_REMAINING_MS = 2 * 60 * 1000;

function currentCode(steamId, steamName) {
  const now = Date.now();

  for (const [code, entry] of codes) {
    if (entry.steamId === steamId && entry.expires - now >= CODE_MIN_REMAINING_MS) {
      return { code, expires: entry.expires };
    }
  }

  const code = createCode(steamId, steamName);
  return { code, expires: codes.get(code).expires };
}

function liveCode(code) {
  const entry = codes.get(code);
  return entry && entry.expires > Date.now() ? entry : null;
}

// Guessing codes with one's own key would link it to someone else's Steam account
const allowAttempt = makeLimiter({ perAddress: 10, total: 600 });

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
  linkedKeys: db.prepare("SELECT child_id FROM associations WHERE parent_id = ? AND child_id LIKE 'key_%' ORDER BY child_id")
};

function linkedKeys(steamId) {
  return stmts.linkedKeys.all(steamId).map(row => row.child_id);
}

function validCode(code) {
  return typeof code === 'string' && /^[A-Z0-9]{8}$/.test(code.toUpperCase());
}

// Whose Steam account a code links to, for the game to show before the player agrees
router.get('/info', (req, res) => {
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
    return res.status(404).send('Invalid or expired code. Get a new one on hypersomnia.io/link.');
  }

  res.json({ steam_id: entry.steamId, name: entry.steamName || '' });
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
    return res.status(401).send('Invalid or expired code. Get a new one on hypersomnia.io/link.');
  }

  if (!verifySignature(public_key, `hypersomnia-link-v1 ${normalizedCode} ${entry.steamId}`, signature)) {
    return res.status(401).send('Invalid signature.');
  }

  const child = `key_${public_key}`;
  const parent = stmts.parentOf.get(child);

  // The code stays valid, so it can be used once the key is unlinked from the other account
  if (parent && parent.parent_id !== entry.steamId) {
    return res.status(409).send('This key is already linked to another Steam account. Unlink it there first.');
  }

  // Every new device or browser is a new key: a few are fine, an endless stream is not
  if (!parent && linkedKeys(entry.steamId).length >= MAX_KEYS_PER_STEAM_ACCOUNT) {
    return res.status(409).send(`This Steam account already has ${MAX_KEYS_PER_STEAM_ACCOUNT} keys linked. Unlink old ones on hypersomnia.io/profile.`);
  }

  // Single use: a code is gone once it linked a key
  codes.delete(normalizedCode);

  db.transaction(() => {
    stmts.link.run(child, entry.steamId);
    moveProgressIfFirst(child, entry.steamId);
  })();

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

  db.prepare('DELETE FROM progress_moves WHERE child_id = ?').run(child);
}

router.post('/', (req, res) => link(req.body, clientIp(req), res));

// The web build can only make GET requests
router.get('/link', (req, res) => link(req.query, clientIp(req), res));

/*
  "Sign in with Steam" in the web build: the game opens /link_key/start?state=<its random state> in a new tab.
  Signed in through Steam (here, or on the way), the player gets a code that goes back to the game - only ever to
  LINK_RETURN_URL, with the game's state, which the game checks. The game still shows whose Steam account it is
  and links only once the player confirms.
*/
router.get('/start', (req, res) => {
  const { state } = req.query;

  if (typeof state !== 'string' || !/^[0-9a-f]{32}$/.test(state)) {
    return res.status(400).send('Invalid request.');
  }

  if (!req.user) {
    req.session.after_login = `/link_key/start?state=${state}`;
    return res.redirect('/auth/steam');
  }

  const code = createCode(`steam_${req.user.id}`, req.user.displayName);
  res.redirect(`${config.LINK_RETURN_URL}#code=${code}&state=${state}`);
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

  const { public_key, signature } = params || {};
  const timestamp = typeof params.timestamp === 'string' ? Number(params.timestamp) : params.timestamp;

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
  const parent = stmts.parentOf.get(child);

  if (!parent) {
    return res.json({ unlinked: child, from: null });
  }

  db.transaction(() => {
    stmts.unlink.run(child, parent.parent_id);
    moveProgressBack(child, parent.parent_id);
  })();

  console.log(`[link_key] Unlinked ${child} from ${parent.parent_id} by its own signature.`);

  res.json({ unlinked: child, from: parent.parent_id });
}

router.post('/unlink', (req, res) => unlinkBySignature(req.body, clientIp(req), res));
router.get('/unlink', (req, res) => unlinkBySignature(req.query, clientIp(req), res));

module.exports = { router, createCode, currentCode, liveCode, linkedKeys, verifySignature, unlink: (child, steamId) => stmts.unlink.run(child, steamId) };
