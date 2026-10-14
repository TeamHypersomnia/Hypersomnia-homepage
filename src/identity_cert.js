// Certs of the identity broker - the same binary format as src/application/network/identity_cert.h in the game.
//
// A cert binds an account to a player's session key (made by the game at every start, kept only in memory).
// The broker signs it after checking a Steam ticket, a CrazyGames token or an account key's signature.

const crypto = require('crypto');

const CERT_TAG = Buffer.from('hs-cert-v1');
const CERT_REQUEST_TAG = Buffer.from('hs-cert-req-v1');
const FORMAT_VERSION = 1;
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

function unsignedBytes({ account, sessionPublicKey, notBefore, notAfter }) {
  const accountBytes = Buffer.from(account, 'utf8');

  if (accountBytes.length === 0 || accountBytes.length > MAX_ACCOUNT_LENGTH) {
    throw new Error('Invalid account length');
  }

  if (!Buffer.isBuffer(sessionPublicKey) || sessionPublicKey.length !== 32) {
    throw new Error('A session public key has 32 bytes');
  }

  return Buffer.concat([
    Buffer.from([FORMAT_VERSION, accountBytes.length]),
    accountBytes,
    sessionPublicKey,
    writeI64(notBefore),
    writeI64(notAfter)
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

module.exports = {
  CERT_TAG,
  CERT_REQUEST_TAG,
  privateKeyFromSeed,
  publicKeyFromRaw,
  rawPublicKey,
  signedMessage,
  makeCert,
  certRequestMessage
};
