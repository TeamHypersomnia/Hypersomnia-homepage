const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');

/*
  The official servers: one file per server in OFFICIAL_SERVERS_DIR, named after its server id
  (e.g. "de", "us-central") and holding nothing but its official_server_secret.
  The masterserver reads the same directory to recognize the official servers by their signed heartbeats.

  Read on every lookup so that adding or removing a file takes effect immediately -
  there are only a handful of tiny files and the lookups only happen on match reports.
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

function readOfficialServers() {
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

      const secret = fs.readFileSync(file, 'utf8').trim();
      if (secret) servers.push({ server_id: name, secret });
    } catch (err) {
      console.error(`Could not read the official server ${name}:`, err.message);
    }
  }

  return servers;
}

/*
  Compares digests so that the comparison takes the same time
  whatever the length of the secrets and wherever they differ.
*/
const digest = (s) => crypto.createHash('sha256').update(s, 'utf8').digest();

function findServerIdBySecret(secret) {
  if (typeof secret !== 'string' || !secret) return null;

  const given = digest(secret);
  let found = null;

  for (const server of readOfficialServers()) {
    if (crypto.timingSafeEqual(given, digest(server.secret))) {
      found = server.server_id;
    }
  }

  return found;
}

/*
  Express middleware: authorizes an official server by its secret in the "apikey" header
  and sets req.server_id. With onlyServerIds, only those servers are let in.
*/
function officialServerAuth(onlyServerIds = null) {
  return (req, res, next) => {
    const serverId = findServerIdBySecret(req.headers['apikey']);

    if (!serverId) return res.status(401).json({ error: 'Unauthorized' });
    if (onlyServerIds && !onlyServerIds.includes(serverId)) return res.status(401).json({ error: 'Unauthorized' });

    req.server_id = serverId;
    next();
  };
}

seedTestServers();

module.exports = { officialServerAuth, findServerIdBySecret };
