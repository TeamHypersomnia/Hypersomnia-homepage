const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const identityCert = require('./identity_cert');

/*
  The official servers: one file per server in OFFICIAL_SERVERS_DIR, named after its server id
  (e.g. "de", "us-central") and holding nothing but its public key in hex - what its --print-server-key prints.
  The masterserver reads the same directory to list them as official.

  Re-read at most every few seconds, so that adding or removing a file takes effect right away.
  Read exactly like the masterserver does (official_servers_registry.h): a key shared by two files authorizes neither.

  An official server signs its match reports with its key: X-Server-Key and X-Signature over "hs-report-v1" and the body.
*/

const dir = config.OFFICIAL_SERVERS_DIR;

const CACHE_MS = 5000;
let cached = null;
let cachedAt = 0;

const trimmed = (s) => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

function readOfficialServers() {
  const now = Date.now();

  if (cached && now - cachedAt < CACHE_MS) return cached;

  // A directory that can not be read for a moment (a sync, a permissions change) keeps the previous list:
  // an empty one would refuse every official report
  const fresh = readOfficialServersNow();

  if (fresh !== null || !cached) {
    cached = fresh || [];
  }

  cachedAt = now;
  return cached;
}

function readOfficialServersNow() {
  let names;

  try {
    names = fs.readdirSync(dir);
  } catch (err) {
    console.error(`Could not read the official servers from ${dir}:`, err.message);
    return null;
  }

  const servers = [];

  for (const name of names) {
    if (name.startsWith('.') || name.endsWith('~')) continue;

    const file = path.join(dir, name);

    try {
      if (!fs.statSync(file).isFile()) continue;

      const key = trimmed(fs.readFileSync(file, 'utf8'));

      if (/^[0-9a-f]{64}$/.test(key)) servers.push({ server_id: name, key });
      else console.error(`Official server ${name}: not a public key, skipping.`);
    } catch (err) {
      console.error(`Could not read the official server ${name}:`, err.message);
    }
  }

  const count = new Map();
  for (const server of servers) count.set(server.key, (count.get(server.key) || 0) + 1);

  return servers.filter(server => {
    if (count.get(server.key) === 1) return true;

    console.error(`Official server ${server.server_id}: the same key as another one, skipping both.`);
    return false;
  });
}

/*
  --test: the official servers "pl" and "au" with keys from public seeds (sha256 of "hypersomnia-test-server-<id>"),
  which run_mmr_tests.py signs its reports with. Never in production, where the masterserver reads the same directory.
*/
function seedTestServers() {
  if (!config.IS_TEST) return;

  if (config.IS_PROD) {
    console.error('[test] Not seeding the test official servers in production.');
    return;
  }

  fs.mkdirSync(dir, { recursive: true });

  for (const id of ['pl', 'au']) {
    const file = path.join(dir, id);
    const seed = crypto.createHash('sha256').update(`hypersomnia-test-server-${id}`).digest();
    const key = identityCert.rawPublicKey(identityCert.privateKeyFromSeed(seed)).toString('hex');

    fs.writeFileSync(file, key + '\n', { mode: 0o600 });
  }

  console.log('[test] Seeded official servers: pl, au');
}

seedTestServers();

function findServerIdByKey(keyHex) {
  if (typeof keyHex !== 'string' || !/^[0-9a-f]{64}$/.test(keyHex)) return null;

  const found = readOfficialServers().find(server => server.key === keyHex);
  return found ? found.server_id : null;
}

let lastRefusalLog = 0;

function logRefusal(message) {
  const now = Date.now();

  if (now - lastRefusalLog > 10000) {
    lastRefusalLog = now;
    console.error(message);
  }
}

/*
  Express middleware: authorizes an official server by the signature of its key over the raw body
  and sets req.server_id. With onlyServerIds, only those servers are let in.
*/
function officialServerAuth(onlyServerIds = null) {
  return (req, res, next) => {
    const keyHex = String(req.headers['x-server-key'] || '');
    const signatureHex = String(req.headers['x-signature'] || '');
    const serverId = findServerIdByKey(keyHex);

    // The list itself unavailable is no verdict on the server - it retries a 503
    if (!serverId && readOfficialServers().length === 0) {
      logRefusal(`[official] No official servers known (${dir} empty or unreadable) - answering 503.`);
      return res.status(503).json({ error: 'Official servers unavailable' });
    }

    if (!serverId) {
      logRefusal(`[official] Refused a request signed by an unknown key ${keyHex.slice(0, 16)}... - not in ${dir}.`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!/^[0-9a-f]{128}$/.test(signatureHex) || !req.rawBody) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // The same check as linking's - weak (small order) keys refused too
    const { verifySignature } = require('./link_key');
    const valid = verifySignature(keyHex, Buffer.concat([Buffer.from('hs-report-v1'), req.rawBody]), signatureHex);

    if (!valid) return res.status(401).json({ error: 'Unauthorized' });
    if (onlyServerIds && !onlyServerIds.includes(serverId)) return res.status(401).json({ error: 'Unauthorized' });

    req.server_id = serverId;
    next();
  };
}

module.exports = { officialServerAuth, findServerIdByKey };
