const crypto = require('crypto');
const net = require('net');
const express = require('express');
const db = require('./db');

/*
  Linking an identity key (the account of a player without Steam, "key_<public key in hex>")
  to a Steam account, so that the ranked matches played with the key count for the Steam account.

  1. Signed in through Steam, the player gets a one-time code on /profile (createCode).
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

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_LIFETIME_MS = 10 * 60 * 1000;

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

function liveCode(code) {
  const entry = codes.get(code);
  return entry && entry.expires > Date.now() ? entry : null;
}

// Guessing codes with one's own key would link it to someone else's Steam account
const attempts = new Map();
const MAX_ATTEMPTS_PER_MINUTE = 10;
const MAX_ALL_ATTEMPTS_PER_MINUTE = 600;
let allAttempts = 0;
let attemptsWindowStart = Date.now();

// An IPv6 client usually has a whole /64 to rotate through, so it is limited as one
function limitKey(ip) {
  if (!net.isIPv6(ip) || ip.startsWith('::ffff:')) return ip;

  const [head, tail = ''] = ip.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = Array(8 - headGroups.length - tailGroups.length).fill('0');

  return [...headGroups, ...missing, ...tailGroups].slice(0, 4).join(':') + '::/64';
}

function allowAttempt(ip) {
  const now = Date.now();

  if (now - attemptsWindowStart > 60 * 1000) {
    attempts.clear();
    allAttempts = 0;
    attemptsWindowStart = now;
  }

  const key = limitKey(ip);
  const count = (attempts.get(key) || 0) + 1;
  attempts.set(key, count);

  if (count > MAX_ATTEMPTS_PER_MINUTE) return false;

  // Only the attempts let through count overall, so one address over its limit can not use up everyone's
  return ++allAttempts <= MAX_ALL_ATTEMPTS_PER_MINUTE;
}

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

    return crypto.verify(null, Buffer.from(message, 'utf8'), key, Buffer.from(signatureHex, 'hex'));
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
  const ip = req.headers['x-real-ip'] || req.ip;

  if (!allowAttempt(ip)) {
    return res.status(429).send('Too many attempts. Try again in a minute.');
  }

  const { code } = req.query;

  if (!validCode(code)) {
    return res.status(400).send('Invalid request.');
  }

  const entry = liveCode(code.toUpperCase());

  if (!entry) {
    return res.status(404).send('Invalid or expired code. Get a new one on hypersomnia.io/profile.');
  }

  res.json({ steam_id: entry.steamId, name: entry.steamName || '' });
});

router.post('/', (req, res) => {
  const ip = req.headers['x-real-ip'] || req.ip;

  if (!allowAttempt(ip)) {
    return res.status(429).send('Too many attempts. Try again in a minute.');
  }

  const { public_key, code, signature } = req.body || {};

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
    return res.status(401).send('Invalid or expired code. Get a new one on hypersomnia.io/profile.');
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

  // Single use: a code is gone once it linked a key
  codes.delete(normalizedCode);

  stmts.link.run(child, entry.steamId);
  console.log(`[link_key] Linked ${child} to ${entry.steamId}.`);

  res.json({ linked: child, to: entry.steamId });
});

module.exports = { router, createCode, linkedKeys, verifySignature, unlink: (child, steamId) => stmts.unlink.run(child, steamId) };
