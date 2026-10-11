const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');

/*
  The official servers: one file per server in OFFICIAL_SERVERS_DIR, named after its server id
  (e.g. "de", "us-central") and holding nothing but its official_server_secret.
  The masterserver reads the same directory to recognize the official servers by their signed heartbeats.

  Re-read at most every few seconds, so that adding or removing a file takes effect right away.

  Read exactly like the masterserver does (official_servers_registry.h): the secret trimmed of spaces,
  tabs and line breaks only, and a secret shared by two files authorizes neither.
*/

const dir = config.OFFICIAL_SERVERS_DIR;

function seedTestServers() {
  if (!config.IS_TEST) return;

  fs.mkdirSync(dir, { recursive: true });

  for (const id of ['pl', 'au']) {
    const file = path.join(dir, id);

    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, id + '\n', { mode: 0o600 });
    }
  }

  console.log('[test] Seeded official servers: pl, au');
}

const CACHE_MS = 5000;
let cached = null;
let cachedAt = 0;

const trimmed = (s) => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

function readOfficialServers() {
  const now = Date.now();

  if (cached && now - cachedAt < CACHE_MS) return cached;

  cached = readOfficialServersNow();
  cachedAt = now;
  return cached;
}

function readOfficialServersNow() {
  let names;

  try {
    names = fs.readdirSync(dir);
  } catch (err) {
    console.error(`Could not read the official servers from ${dir}:`, err.message);
    return [];
  }

  const servers = [];

  for (const name of names) {
    if (name.startsWith('.') || name.endsWith('~')) continue;

    const file = path.join(dir, name);

    try {
      if (!fs.statSync(file).isFile()) continue;

      const secret = trimmed(fs.readFileSync(file, 'utf8'));
      if (secret) servers.push({ server_id: name, secret });
    } catch (err) {
      console.error(`Could not read the official server ${name}:`, err.message);
    }
  }

  const count = new Map();
  for (const server of servers) count.set(server.secret, (count.get(server.secret) || 0) + 1);

  return servers.filter(server => {
    if (count.get(server.secret) === 1) return true;

    console.error(`Official server ${server.server_id}: the same secret as another one, skipping both.`);
    return false;
  });
}

/*
  Servers report with this key in hex instead of the secret itself,
  so that a mistyped report URL reveals only this key - see official_server_keys.h.
*/
const reportKey = (secret) => crypto.createHmac('sha256', secret).update('hypersomnia-report-v1').digest('hex');

/*
  Compares digests so that the comparison takes the same time
  whatever the length of the secrets and wherever they differ.
*/
const digest = (s) => crypto.createHash('sha256').update(s, 'utf8').digest();

function findServerIdByReportKey(key) {
  if (typeof key !== 'string' || !key) return null;

  const given = digest(key);
  let found = null;

  for (const server of readOfficialServers()) {
    if (crypto.timingSafeEqual(given, digest(reportKey(server.secret)))) {
      found = server.server_id;
    }
  }

  return found;
}

/*
  Express middleware: authorizes an official server by its report key in the "apikey" header
  and sets req.server_id. With onlyServerIds, only those servers are let in.
*/
function officialServerAuth(onlyServerIds = null) {
  return (req, res, next) => {
    const serverId = findServerIdByReportKey(req.headers['apikey']);

    if (!serverId) return res.status(401).json({ error: 'Unauthorized' });
    if (onlyServerIds && !onlyServerIds.includes(serverId)) return res.status(401).json({ error: 'Unauthorized' });

    req.server_id = serverId;
    next();
  };
}

seedTestServers();

module.exports = { officialServerAuth, findServerIdByReportKey, reportKey };
