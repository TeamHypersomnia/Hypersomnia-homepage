const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { clientIp } = require('./client_ip');
const axios = require('axios');
const db = require('./db');
const config = require('./config');

if (!config.CRAZYGAMES_GAME_ID) {
  console.error('[broker] CRAZYGAMES_GAME_ID is not set - every CrazyGames sign-in is refused.');
}
const identityCert = require('./identity_cert');
const { verifySignature, linkBySteamTicket, touchKey, deviceOf } = require('./link_key');
const { makeLimiter, limitKey, wideLimitKey } = require('./limiter');
const { getAvatar } = require('./avatars');

/*
  The identity broker: certs that bind a player's account to the game's key (its session key - see identity_cert.h
  in the game). The game servers check them offline with the broker's public key from their config -
  they never ask Steam, CrazyGames or this site anything.

  GET /cert?session=<hex>&steam=<ticket hex>[&link=1&key=<hex>&sig=<hex>] a Steam Web API ticket requested for the session key's
                                                     identity; link=1 (the Steam build) with the key's signature (as below):
                                                     the key is linked to that Steam account,
                                                     so later certs need only the key's signature - no Steam API call
  GET /cert?session=<hex>&crazygames=header         a CrazyGames token of this game, in the X-CrazyGames-Token header
  GET /cert?session=<hex>&key=<hex>&sig=<hex>       an account key's signature of "hs-cert-req-v1" and the session key

  An account key linked to a Steam account gets a cert for that Steam account. 200 with JSON:
    {"cert": "<the cert in hex>", "name": "<string>", "avatar": "<base64 of the image bytes>"}
  name and avatar: a steam_ account's Steam name and medium avatar (a JPEG) - the web build can not ask Steam itself;
  a key_ account's last nickname and avatar from reported matches (used by the game when a key is imported);
  empty for crazygames_ (the game has them from the CrazyGames SDK) or when unknown.
  4xx with a reason the game shows to the player. A GET, since the web build fetches only that way -
  nginx keeps /cert out of its logs.
*/

const router = express.Router();

const CERT_LIFETIME_SECS = 4 * 60 * 60;
const STEAM_APP_ID = 2660970;
// Per address - a school starting the game together fits - and in all only to bound the CPU,
// far above what players need, so that a flood from many addresses does not lock everyone out of certs
// A whole /24 or /48 has its own limit too - one /48 holds 65536 /64s, enough to use up the total alone.
// Only what an address was allowed counts there - one host over its own limit does not use up its network's (e.g. CGNAT).
// The total last: only what both an address and its network were allowed uses it up.
const allowRequestPerAddress = makeLimiter({ perAddress: 150 });
const allowRequestPerNetwork = makeLimiter({ perAddress: 1500, keyOf: wideLimitKey });
const allowRequestInAll = makeLimiter({ perAddress: Infinity, total: 60000, keyOf: () => 'all' });
const allowRequest = ip => allowRequestPerAddress(ip) && allowRequestPerNetwork(ip) && allowRequestInAll(ip);

// Every Steam ticket and every profile fetch costs a call to the Steam Web API, whose key has a daily quota: a flood of
// bogus tickets must not use it up for everyone. A real player asks every two hours (a cert lives 4) and the profile is
// cached for a day - so a few calls a minute per address, and a global cap within the quota.
//
// Addresses whose ticket Steam accepted in the last day are past the global cap (only their own limit counts), so a
// flood of bogus tickets from new addresses - counted by their /24 or /48 - can not lock out the players already here.
// Profile fetches have a cap of their own.
const allowKnownSteamCall = makeLimiter({ perAddress: 10 });
const allowNewSteamCall = makeLimiter({ perAddress: 10, total: 120, keyOf: wideLimitKey });
const allowProfileCall = makeLimiter({ perAddress: 10, total: 120 });
const KNOWN_ADDRESS_MS = 24 * 60 * 60 * 1000;
const knownSteamAddresses = new Map();

function allowSteamCall(ip) {
  const key = limitKey(ip);
  const knownUntil = knownSteamAddresses.get(key);

  if (knownUntil !== undefined && knownUntil > Date.now()) {
    return allowKnownSteamCall(ip);
  }

  knownSteamAddresses.delete(key);
  return allowNewSteamCall(ip);
}

function rememberSteamAddress(ip) {
  // Bounded: old entries go first
  if (knownSteamAddresses.size > 100000) {
    knownSteamAddresses.delete(knownSteamAddresses.keys().next().value);
  }

  knownSteamAddresses.set(limitKey(ip), Date.now() + KNOWN_ADDRESS_MS);
}

/*
  The broker's key: hypersomnia-key-v1:<seed hex>, like the game's key files.
*/

function loadBrokerKey() {
  const file = config.BROKER_KEY_PATH;

  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    const match = /^hypersomnia-key-v1:([0-9a-f]{64})$/.exec(text);

    if (!match) {
      console.error(`[broker] ${file} is not a key. No certs are issued.`);
      return null;
    }

    const privateKey = identityCert.privateKeyFromSeed(Buffer.from(match[1], 'hex'));
    console.log(`[broker] Signing certs with ${identityCert.rawPublicKey(privateKey).toString('hex')}.`);
    return privateKey;
  } catch (err) {
    console.error(`[broker] Could not read the broker key from ${file}: ${err.message}. No certs are issued.`);
    return null;
  }
}

const brokerKey = loadBrokerKey();

const stmts = {
  parentOf: db.prepare('SELECT parent_id FROM associations WHERE child_id = ?'),
  banned: db.prepare('SELECT reason FROM broker_bans WHERE account = ?'),
  ban: db.prepare('INSERT OR IGNORE INTO broker_bans (account, reason) VALUES (?, ?)'),
  steamProfile: db.prepare('SELECT name, avatar, fetched_at FROM steam_profiles WHERE account_id = ?'),
  setSteamProfile: db.prepare('INSERT OR REPLACE INTO steam_profiles (account_id, name, avatar, fetched_at) VALUES (?, ?, ?, ?)'),
  lastNickname: db.prepare(`
    SELECT nickname FROM last_nicknames WHERE account_id = @id
    UNION ALL SELECT nickname FROM mmr_team WHERE account_id = @id AND nickname IS NOT NULL
    UNION ALL SELECT nickname FROM mmr_ffa WHERE account_id = @id AND nickname IS NOT NULL
    LIMIT 1
  `)
};

function bannedReason(account) {
  const row = stmts.banned.get(account);
  return row ? (row.reason || 'Banned.') : null;
}

/*
  What the game requests the Steam ticket for - identity_cert::steam_ticket_identity.
*/

function steamTicketIdentity(sessionPublicKey) {
  return crypto.createHash('sha256').update(Buffer.concat([Buffer.from('hs-steam-v1'), sessionPublicKey])).digest().subarray(0, 15).toString('hex');
}

async function steamAccount(ticketHex, sessionPublicKey, ip) {
  if (!config.STEAM_API_KEY) {
    throw { status: 503, message: 'Steam sign in is not available right now.' };
  }

  // A Web API ticket is a few hundred bytes - nothing shorter is worth asking Steam about
  if (ticketHex.length < 200 || ticketHex.length % 2 !== 0) {
    throw { status: 401, message: 'Steam did not accept the ticket.' };
  }

  if (!allowSteamCall(ip)) {
    throw { status: 503, message: 'Too many sign ins right now. Retrying soon.' };
  }

  const response = await axios.get('https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/', {
    params: {
      key: config.STEAM_API_KEY,
      appid: STEAM_APP_ID,
      ticket: ticketHex,
      identity: steamTicketIdentity(sessionPublicKey)
    },
    // Shorter than the game's own wait for /cert, so that it gets this answer rather than giving up first
    timeout: 3000,
    maxRedirects: 0
  });

  const body = response.data && response.data.response;
  const params = body && body.params;

  // Only Steam's own verdict on the ticket refuses it - anything else (throttling, an outage) is retried by the game
  if (!params) {
    if (body && body.error && typeof body.error.errorcode === 'number' && (body.error.errorcode === 3 || (body.error.errorcode >= 100 && body.error.errorcode < 200))) {
      throw { status: 401, message: 'Steam did not accept the ticket.' };
    }

    throw { status: 502, message: 'Could not verify the account with Steam right now. Retrying soon.' };
  }

  if (params.result !== 'OK' || !/^[0-9]{1,20}$/.test(params.steamid || '')) {
    throw { status: 401, message: 'Steam did not accept the ticket.' };
  }

  rememberSteamAddress(ip);

  if (params.publisherbanned || params.vacbanned) {
    // Remembered, so that keys linked to this account are refused too - they never show Steam a ticket
    stmts.ban.run(`steam_${params.steamid}`, 'This Steam account is banned.');
    throw { status: 403, message: 'This Steam account is banned.' };
  }

  // Family Sharing: the owner's ban counts too
  if (params.ownersteamid && params.ownersteamid !== params.steamid) {
    const ownerBan = bannedReason(`steam_${params.ownersteamid}`);

    if (ownerBan) throw { status: 403, message: ownerBan };
  }

  return `steam_${params.steamid}`;
}

/*
  A Steam account's name and medium avatar (64x64 JPEG) for the game's profile, from GetPlayerSummaries with the broker's key.
  Cached a day per account; Steam failing or the call limit reached gives the stale cache or nothing - never fails the cert.
  The avatar is fetched only from https://*.steamstatic.com, at most 64 KB.
*/
const STEAM_PROFILE_CACHE_SECS = 24 * 60 * 60;
const MAX_STEAM_AVATAR_BYTES = 64 * 1024;

function isSteamAvatarUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.port === '' && url.username === '' &&
      (url.hostname === 'steamstatic.com' || url.hostname.endsWith('.steamstatic.com'));
  } catch {
    return false;
  }
}

async function fetchSteamProfile(steamId, deadline) {
  // Whatever is left of the request's time, so that the game gets its cert before it gives up waiting
  const timeLeft = () => Math.min(3000, deadline - Date.now());

  if (timeLeft() < 500) return null;

  const response = await axios.get('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/', {
    params: { key: config.STEAM_API_KEY, steamids: steamId },
    timeout: timeLeft(),
    maxRedirects: 0
  });

  const players = response.data && response.data.response && response.data.response.players;
  const player = Array.isArray(players) ? players.find(p => p && p.steamid === steamId) : null;

  if (!player || typeof player.personaname !== 'string') return null;

  const name = player.personaname.slice(0, 64);

  if (!isSteamAvatarUrl(player.avatarmedium)) {
    return { name, avatar: null };
  }

  if (timeLeft() < 500) return null;

  const image = await axios.get(player.avatarmedium, {
    responseType: 'arraybuffer',
    timeout: timeLeft(),
    maxRedirects: 0,
    maxContentLength: MAX_STEAM_AVATAR_BYTES
  });

  return { name, avatar: Buffer.from(image.data) };
}

async function steamProfile(account, ip, deadline) {
  const cached = stmts.steamProfile.get(account);
  const now = Math.floor(Date.now() / 1000);

  if (cached && now - cached.fetched_at < STEAM_PROFILE_CACHE_SECS) {
    return cached;
  }

  const stale = cached || { name: '', avatar: null };

  if (!config.STEAM_API_KEY || !allowProfileCall(ip)) {
    return stale;
  }

  try {
    const fetched = await fetchSteamProfile(account.slice('steam_'.length), deadline);

    if (!fetched) return stale;

    stmts.setSteamProfile.run(account, fetched.name, fetched.avatar, now);
    return fetched;
  } catch (err) {
    console.error(`[broker] Could not fetch the Steam profile of ${account}:`, err && err.message ? err.message : err);
    return stale;
  }
}

async function accountProfile(account, ip, deadline) {
  if (account.startsWith('steam_')) {
    return steamProfile(account, ip, deadline);
  }

  if (account.startsWith('key_')) {
    const nickname = stmts.lastNickname.get({ id: account });
    return { name: nickname ? nickname.nickname : '', avatar: getAvatar(account) };
  }

  return { name: '', avatar: null };
}

let crazyGamesKey = null;
let crazyGamesKeyFetchedAt = 0;
let crazyGamesKeyFetch = null;
let crazyGamesKeyFailedAt = 0;

// One fetch for all the requests waiting on it; a failure is remembered for 30 s - with CrazyGames down,
// every /cert would otherwise wait for its own timeout, longer than the game waits
async function crazyGamesPublicKey() {
  if (crazyGamesKey && Date.now() - crazyGamesKeyFetchedAt < 60 * 60 * 1000) {
    return crazyGamesKey;
  }

  const unavailable = { status: 503, message: 'CrazyGames sign in is not available right now.' };

  if (Date.now() - crazyGamesKeyFailedAt < 30 * 1000) {
    throw unavailable;
  }

  if (!crazyGamesKeyFetch) {
    crazyGamesKeyFetch = axios.get('https://sdk.crazygames.com/publicKey.json', { timeout: 3000, maxRedirects: 0 })
      .then(response => {
        if (!response.data || typeof response.data.publicKey !== 'string') {
          throw unavailable;
        }

        crazyGamesKey = response.data.publicKey;
        crazyGamesKeyFetchedAt = Date.now();
        return crazyGamesKey;
      })
      .catch(() => {
        crazyGamesKeyFailedAt = Date.now();
        throw unavailable;
      })
      .finally(() => {
        crazyGamesKeyFetch = null;
      });
  }

  return crazyGamesKeyFetch;
}

function decodeBase64Url(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function crazyGamesAccount(token) {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw { status: 400, message: 'Invalid CrazyGames token.' };
  }

  const parseJson = (part) => {
    try {
      return JSON.parse(decodeBase64Url(part).toString('utf8'));
    } catch (err) {
      throw { status: 400, message: 'Invalid CrazyGames token.' };
    }
  };

  const header = parseJson(parts[0]);

  if (!header || header.alg !== 'RS256') {
    throw { status: 401, message: 'Invalid CrazyGames token.' };
  }

  const publicKey = config.CRAZYGAMES_PUBLIC_KEY || await crazyGamesPublicKey();
  const valid = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, decodeBase64Url(parts[2]));

  if (!valid) {
    throw { status: 401, message: 'Invalid CrazyGames token.' };
  }

  const payload = parseJson(parts[1]);

  if (!payload || typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    throw { status: 401, message: 'The CrazyGames sign in has expired. Sign in again.' };
  }

  // A token of another game on CrazyGames must not pass for an account of this one - without the id configured, none passes
  if (!config.CRAZYGAMES_GAME_ID || String(payload.gameId) !== config.CRAZYGAMES_GAME_ID) {
    throw { status: 401, message: 'Invalid CrazyGames token.' };
  }

  if (typeof payload.userId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(payload.userId)) {
    throw { status: 401, message: 'Invalid CrazyGames token.' };
  }

  return `crazygames_${payload.userId}`;
}

function keyAccount(publicKeyHex, signatureHex, sessionPublicKey) {
  if (!/^[0-9a-f]{64}$/.test(publicKeyHex) || !/^[0-9a-f]{128}$/.test(signatureHex)) {
    throw { status: 400, message: 'Invalid request.' };
  }

  const message = identityCert.certRequestMessage(sessionPublicKey);

  if (!verifySignature(publicKeyHex, message, signatureHex)) {
    throw { status: 401, message: 'Invalid signature.' };
  }

  const child = `key_${publicKeyHex}`;

  // A banned key stays banned while linked too
  const keyBan = bannedReason(child);

  if (keyBan) {
    throw { status: 403, message: keyBan };
  }

  const parent = stmts.parentOf.get(child);

  // A key linked to a Steam account plays on it
  return parent ? parent.parent_id : child;
}

// The browser asks first whether it may send the CrazyGames token in its header
router.options('/', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'X-CrazyGames-Token');
  res.set('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Access-Control-Allow-Origin', '*');

  const ip = clientIp(req);
  const { session, steam, key, sig } = req.query;

  const { device, os } = deviceOf(req.query);

  // The CrazyGames token comes in a header - a URL (with it) could end up in a log
  const crazygames = req.query.crazygames === 'header' ? req.get('X-CrazyGames-Token') : undefined;

  // Malformed requests are refused before they count against anyone's limits
  if (typeof session !== 'string' || !/^[0-9a-f]{64}$/.test(session)) {
    return res.status(400).send('Invalid request.');
  }

  if (!allowRequest(ip)) {
    return res.status(429).send('Too many requests. Try again in a minute.');
  }

  if (!brokerKey) {
    return res.status(503).send('Signing in is not available right now.');
  }

  const sessionPublicKey = Buffer.from(session, 'hex');
  // The game waits 5 seconds for /cert: the profile is fetched only within the first 4
  const deadline = Date.now() + 4000;

  try {
    const account = await (async () => {
      if (typeof steam === 'string' && /^[0-9a-f]{2,4096}$/.test(steam)) {
        const steamId = await steamAccount(steam, sessionPublicKey, ip);

        // The Steam build: linked by this ticket once, by its key's signature from then on (the session key is the key).
        // Only with the key's own signature over this very ticket - a ticket can be asked for any public key (e.g. one off
        // the leaderboards), and the cert request signature, the same in every request, could have been seen anywhere.
        if (req.query.link === '1') {
          const signedByTheKey = typeof key === 'string' && typeof sig === 'string' && key === session
            && /^[0-9a-f]{128}$/.test(sig)
            && verifySignature(key, identityCert.linkRequestMessage(sessionPublicKey, Buffer.from(steam, 'hex')), sig);

          if (signedByTheKey) {
            linkBySteamTicket(`key_${session}`, steamId, device, os);
          }
          else {
            console.log(`[broker] Not linking key_${session}: link=1 without the key's signature.`);
          }
        }

        return steamId;
      }
      if (typeof crazygames === 'string' && crazygames.length <= 4096) return crazyGamesAccount(crazygames);
      if (typeof key === 'string' && typeof sig === 'string') {
        const resolved = keyAccount(key, sig, sessionPublicKey);

        if (resolved !== `key_${key}`) {
          touchKey(`key_${key}`);
        }

        return resolved;
      }
      throw { status: 400, message: 'Invalid request.' };
    })();

    const ban = bannedReason(account);

    if (ban) {
      return res.status(403).send(ban);
    }

    const now = Math.floor(Date.now() / 1000);

    const cert = identityCert.makeCert(brokerKey, {
      account,
      sessionPublicKey,
      notBefore: now,
      notAfter: now + CERT_LIFETIME_SECS
    });

    const profile = await accountProfile(account, ip, deadline);

    res.json({
      cert: cert.toString('hex'),
      name: profile.name || '',
      avatar: profile.avatar ? Buffer.from(profile.avatar).toString('base64') : ''
    });
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).send(err.message);
    }

    // Steam or CrazyGames unreachable, or something unexpected: the game retries later
    console.error('[broker] Could not issue a cert:', err && err.message ? err.message : err);
    res.status(502).send('Could not verify the account right now. Retrying soon.');
  }
});

module.exports = { router, steamTicketIdentity, isSteamAvatarUrl, accountProfile };
