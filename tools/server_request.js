#!/usr/bin/env node
/*
  A request of an official server to the site, signed with that server's key (its server.key), as the game signs its
  match reports - for what an admin sends by hand:
    node tools/server_request.js <site url> <server.key> revert <match id>
    node tools/server_request.js <site url> <server.key> adjust <multiplier>
  Each endpoint has its own tag (see official_servers.js); an adjustment carries the time it was made.
*/
const fs = require('fs');
const crypto = require('crypto');
const { privateKeyFromSeed, rawPublicKey, seedFromKeyFile } = require('../src/identity_cert');

const [siteUrl, keyPath, what, value] = process.argv.slice(2);

if (!siteUrl || !keyPath || !['revert', 'adjust'].includes(what) || value === undefined) {
  console.error('Usage: server_request.js <site url> <server.key> revert <match id> | adjust <multiplier>');
  process.exit(1);
}

const seed = seedFromKeyFile(fs.readFileSync(keyPath, 'utf8'));

if (!seed) {
  console.error(`${keyPath} is not a key file (hypersomnia-key-v1:<64 hex>).`);
  process.exit(1);
}

const privateKey = privateKeyFromSeed(seed);
const publicKeyHex = rawPublicKey(privateKey).toString('hex');

const endpoint = what === 'revert' ? { path: '/revert_match', tag: 'hs-revert-v1' } : { path: '/adjust_negative_mmrs', tag: 'hs-adjust-v1' };

const body = what === 'revert' ?
  JSON.stringify({ match_id: /^[0-9]+$/.test(value) ? Number(value) : value }) :
  JSON.stringify({ multiplier: Number(value), issued_at: Math.floor(Date.now() / 1000) });

const signature = crypto.sign(null, Buffer.concat([Buffer.from(endpoint.tag), Buffer.from(body)]), privateKey).toString('hex');

fetch(siteUrl.replace(/\/$/, '') + endpoint.path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Server-Key': publicKeyHex, 'X-Signature': signature },
  body
}).then(async (res) => {
  console.log(res.status, await res.text());
}).catch((err) => {
  console.error('Request failed:', err.message);
  process.exit(1);
});
