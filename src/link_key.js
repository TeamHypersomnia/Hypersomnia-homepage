const crypto = require('crypto');
const express = require('express');
const db = require('./db');

/*
  Linking an identity key (the account of a player without Steam, "key_<public key in hex>")
  to a Steam account, so that the ranked matches played with the key count for the Steam account.

  1. Signed in through Steam, the player gets a one-time code on /profile (createCode).
  2. The game signs "hypersomnia-link-v1 <code>" with the key and posts it to /link_key.
  3. A valid signature with a valid code links the key as a child of that Steam account.

  The code ties the link to the Steam session that asked for it, and the signature proves the key,
  so nobody can link someone else's key, or link their own key to someone else's Steam account.
*/

const router = express.Router();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_LIFETIME_MS = 10 * 60 * 1000;

// code -> { steamId, expires }; one live code per Steam account
const codes = new Map();

function removeExpired(now) {
  for (const [code, entry] of codes) {
    if (entry.expires <= now) codes.delete(code);
  }
}

function createCode(steamId) {
  const now = Date.now();
  removeExpired(now);

  for (const [code, entry] of codes) {
    if (entry.steamId === steamId) codes.delete(code);
  }

  let code = '';

  for (let i = 0; i < CODE_LENGTH; ++i) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }

  codes.set(code, { steamId, expires: now + CODE_LIFETIME_MS });
  return code;
}

// Single use: a code is gone once consumed, valid or not afterwards
function consumeCode(code) {
  const entry = codes.get(code);
  if (!entry) return null;

  codes.delete(code);
  return entry.expires > Date.now() ? entry.steamId : null;
}

// Guessing codes with one's own key would link it to someone else's Steam account
const attempts = new Map();
const MAX_ATTEMPTS_PER_MINUTE = 10;
let attemptsWindowStart = Date.now();

function allowAttempt(ip) {
  const now = Date.now();

  if (now - attemptsWindowStart > 60 * 1000) {
    attempts.clear();
    attemptsWindowStart = now;
  }

  const count = (attempts.get(ip) || 0) + 1;
  attempts.set(ip, count);
  return count <= MAX_ATTEMPTS_PER_MINUTE;
}

// A raw 32-byte Ed25519 public key wrapped as SPKI DER, the form node:crypto takes
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function verifySignature(publicKeyHex, message, signatureHex) {
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
  link: db.prepare('INSERT OR REPLACE INTO associations (child_id, parent_id) VALUES (?, ?)'),
  unlink: db.prepare('DELETE FROM associations WHERE child_id = ? AND parent_id = ?'),
  linkedKeys: db.prepare("SELECT child_id FROM associations WHERE parent_id = ? AND child_id LIKE 'key_%' ORDER BY child_id")
};

function linkedKeys(steamId) {
  return stmts.linkedKeys.all(steamId).map(row => row.child_id);
}

router.post('/', (req, res) => {
  const ip = req.headers['x-real-ip'] || req.ip;

  if (!allowAttempt(ip)) {
    return res.status(429).send('Too many attempts. Try again in a minute.');
  }

  const { public_key, code, signature } = req.body || {};

  if (typeof public_key !== 'string' || !/^[0-9a-f]{64}$/.test(public_key)
    || typeof signature !== 'string' || !/^[0-9a-f]{128}$/.test(signature)
    || typeof code !== 'string' || !/^[A-Z0-9]{8}$/.test(code.toUpperCase())
  ) {
    return res.status(400).send('Invalid request.');
  }

  const normalizedCode = code.toUpperCase();

  if (!verifySignature(public_key, `hypersomnia-link-v1 ${normalizedCode}`, signature)) {
    return res.status(401).send('Invalid signature.');
  }

  const steamId = consumeCode(normalizedCode);

  if (!steamId) {
    return res.status(401).send('Invalid or expired code. Get a new one on hypersomnia.io/profile.');
  }

  stmts.link.run(`key_${public_key}`, steamId);
  console.log(`[link_key] Linked key_${public_key} to ${steamId}.`);

  res.json({ linked: `key_${public_key}`, to: steamId });
});

module.exports = { router, createCode, linkedKeys, unlink: (child, steamId) => stmts.unlink.run(child, steamId) };
