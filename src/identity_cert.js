// Certs of the identity broker - the same binary format as src/application/network/identity_cert.h in the game.
//
// A cert binds an account to the player's account key, which is also the session key the game signs its connections with.
// The broker signs it after checking a Steam ticket, a CrazyGames token or an account key's signature.

const crypto = require('crypto');

const CERT_TAG = Buffer.from('hs-cert-v1');
const CERT_REQUEST_TAG = Buffer.from('hs-cert-req-v1');
const FORMAT_VERSION = 2;

// What proved the account (identity_cert::proof_type in the game) - a server trusts a Steam account with admin rights
// only when Steam itself proved it, never a key linked to it
const PROOF = { ACCOUNT_KEY: 0, STEAM_TICKET: 1, CRAZYGAMES_TOKEN: 2 };
const MAX_ACCOUNT_LENGTH = 80;

// DER prefixes that wrap a raw Ed25519 seed or public key, so node:crypto takes them
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function privateKeyFromSeed(seed) {
  if (!Buffer.isBuffer(seed) || seed.length !== 32) {
    throw new Error('An Ed25519 seed has 32 bytes');
  }

  return crypto.createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' });
}

function publicKeyFromRaw(raw) {
  return crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw]), format: 'der', type: 'spki' });
}

function rawPublicKey(privateKey) {
  const der = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  return der.subarray(der.length - 32);
}

function writeI64(value) {
  const out = Buffer.alloc(8);
  out.writeBigInt64LE(BigInt(value));
  return out;
}

function unsignedBytes({ account, sessionPublicKey, notBefore, notAfter, proof }) {
  const accountBytes = Buffer.from(account, 'utf8');

  if (accountBytes.length === 0 || accountBytes.length > MAX_ACCOUNT_LENGTH) {
    throw new Error('Invalid account length');
  }

  if (!Buffer.isBuffer(sessionPublicKey) || sessionPublicKey.length !== 32) {
    throw new Error('A session public key has 32 bytes');
  }

  if (!Object.values(PROOF).includes(proof)) {
    throw new Error('Unknown proof of the account');
  }

  return Buffer.concat([
    Buffer.from([FORMAT_VERSION, accountBytes.length]),
    accountBytes,
    sessionPublicKey,
    writeI64(notBefore),
    writeI64(notAfter),
    Buffer.from([proof])
  ]);
}

function signedMessage(cert) {
  return Buffer.concat([CERT_TAG, unsignedBytes(cert)]);
}

// Returns the cert's bytes, signed with the broker's private key.
function makeCert(brokerPrivateKey, cert) {
  const signature = crypto.sign(null, signedMessage(cert), brokerPrivateKey);
  return Buffer.concat([unsignedBytes(cert), signature]);
}

function certRequestMessage(sessionPublicKey) {
  return Buffer.concat([CERT_REQUEST_TAG, sessionPublicKey]);
}

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
    const key = publicKeyFromRaw(Buffer.from(publicKeyHex, 'hex'));

    const bytes = Buffer.isBuffer(message) ? message : Buffer.from(message, 'utf8');
    return crypto.verify(null, bytes, key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

// The seed of a key file - "hypersomnia-key-v1:<64 hex>", as the game writes account.key and server.key - or null
function seedFromKeyFile(text) {
  const match = /^hypersomnia-key-v1:([0-9a-f]{64})$/.exec(String(text).trim());
  return match ? Buffer.from(match[1], 'hex') : null;
}

// What the game requests the Steam ticket for - identity_cert::steam_ticket_identity
function steamTicketIdentity(sessionPublicKey) {
  return crypto.createHash('sha256').update(Buffer.concat([Buffer.from('hs-steam-v1'), sessionPublicKey])).digest().subarray(0, 15).toString('hex');
}

module.exports = {
  PROOF,
  privateKeyFromSeed,
  publicKeyFromRaw,
  rawPublicKey,
  signedMessage,
  makeCert,
  certRequestMessage,
  steamTicketIdentity,
  verifySignature,
  seedFromKeyFile
};
