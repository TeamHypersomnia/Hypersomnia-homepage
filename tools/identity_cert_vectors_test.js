// The cert format byte for byte as the game's test "Identity cert matches the broker's format" (identity_cert.cpp) -
// the same seeds, cert, Steam ticket identity and request signature. Run: node tools/identity_cert_vectors_test.js
const assert = require('assert');
const crypto = require('crypto');
const identityCert = require('../src/identity_cert');

function testSeed(first) {
  return Buffer.from(Array.from({ length: 32 }, (_, i) => (i + first) & 0xff));
}

const broker = identityCert.privateKeyFromSeed(testSeed(1));
const session = identityCert.rawPublicKey(identityCert.privateKeyFromSeed(testSeed(100)));
const account = identityCert.privateKeyFromSeed(testSeed(50));

assert.strictEqual(identityCert.rawPublicKey(broker).toString('hex'), '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664');
assert.strictEqual(session.toString('hex'), '0bbc346a57667c380120bd9c7fd7e51d2c5fdfea37cd2f5bf405b2c6bf6f2d78');
assert.strictEqual(identityCert.rawPublicKey(account).toString('hex'), '5e423033044f56a13a686799487bcbfa63dd1e39204cec27dd39a26daa615628');

const cert = identityCert.makeCert(broker, {
  account: 'steam_76561198000000000',
  sessionPublicKey: session,
  notBefore: 1700000000,
  notAfter: 1700007200,
  proof: identityCert.PROOF.STEAM_TICKET
});

assert.strictEqual(cert.toString('hex'),
  '0217737465616d5f37363536313139383030303030303030300bbc346a57667c380120bd9c7fd7e51d2c5fdfea37cd2f5bf405b2c6bf6f2d78' +
  '00f1536500000000200d54650000000001fda8b046d7649da980a0b7feeeb7aa85ddafa81b21591ac83b5973be94b4c6acf62a60003bb34ad5' +
  'fc55d3ff08bc9a218e184f68c5462f2e48e1b8108123c600');

assert.strictEqual(identityCert.steamTicketIdentity(session), 'b29051783415063ee1f6dd30673ca7');

assert.strictEqual(crypto.sign(null, identityCert.certRequestMessage(session), account).toString('hex'),
  'e905b4fedce090504a28a8d9e369701dca70e59ef41520da384af5d5f0a387af86a950f9a5c57d0aad494121e75736a44436bcdf94eeccbca9cd674d9cc02a03');

console.log('identity cert vectors: OK');
