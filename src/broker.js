const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { clientIp } = require('./client_ip');
const axios = require('axios');
const db = require('./db');
const config = require('./config');
const identityCert = require('./identity_cert');
const { verifySignature, limitKey } = require('./link_key');

/*
  The identity broker: certs that bind a player's account to the session key the game made at start
  (see identity_cert.h in the game). The game servers check them offline with the broker's public key,
  built into the game - they never ask Steam, CrazyGames or this site anything.

  GET /cert?session=<hex>&steam=<ticket hex>       a Steam Web API ticket requested for the session key's identity
  GET /cert?session=<hex>&crazygames=<jwt>         a CrazyGames token of this game
  GET /cert?session=<hex>&key=<hex>&sig=<hex>       an account key's signature of "hs-cert-req-v1" and the session key

  An account key linked to a Steam account gets a cert for that Steam account. 200 with the cert in hex,
  4xx with a reason the game shows to the player. A GET, since the web build fetches only that way -
  nginx keeps /cert out of its logs.
*/

const router = express.Router();

const CERT_LIFETIME_SECS = 2 * 60 * 60;
const STEAM_APP_ID = 2660970;
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_ALL_REQUESTS_PER_MINUTE = 6000;

// Every Steam ticket costs a call to the Steam Web API, whose key has a daily quota: a flood of bogus tickets
// must not use it up for everyone. A real player asks about once an hour.
const MAX_STEAM_CALLS_PER_MINUTE = 120;
let steamCalls = 0;
let steamWindowStart = Date.now();

function allowSteamCall() {
  const now = Date.now();

  if (now - steamWindowStart > 60 * 1000) {
    steamCalls = 0;
    steamWindowStart = now;
  }

  return ++steamCalls <= MAX_STEAM_CALLS_PER_MINUTE;
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

const requests = new Map();
let allRequests = 0;
let windowStart = Date.now();

function allowRequest(ip) {
  const now = Date.now();

  if (now - windowStart > 60 * 1000) {
    requests.clear();
    allRequests = 0;
    windowStart = now;
  }

  const key = limitKey(ip);
  const count = (requests.get(key) || 0) + 1;
  requests.set(key, count);

  if (count > MAX_REQUESTS_PER_MINUTE) return false;

  // Counted only once an address passed its own limit, so one address can not use up everyone's
  return ++allRequests <= MAX_ALL_REQUESTS_PER_MINUTE;
}

const stmts = {
  parentOf: db.prepare('SELECT parent_id FROM associations WHERE child_id = ?'),
  banned: db.prepare('SELECT reason FROM broker_bans WHERE account = ?')
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

async function steamAccount(ticketHex, sessionPublicKey) {
  if (!config.STEAM_API_KEY) {
    throw { status: 503, message: 'Steam sign in is not available right now.' };
  }

  if (!allowSteamCall()) {
    throw { status: 503, message: 'Too many sign ins right now. Retrying soon.' };
  }

  const response = await axios.get('https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/', {
    params: {
      key: config.STEAM_API_KEY,
      appid: STEAM_APP_ID,
      ticket: ticketHex,
      identity: steamTicketIdentity(sessionPublicKey)
    },
    timeout: 5000,
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

  if (params.publisherbanned || params.vacbanned) {
    throw { status: 403, message: 'This Steam account is banned.' };
  }

  // Family Sharing: the owner's ban counts too
  if (params.ownersteamid && params.ownersteamid !== params.steamid) {
    const ownerBan = bannedReason(`steam_${params.ownersteamid}`);

    if (ownerBan) throw { status: 403, message: ownerBan };
  }

  return `steam_${params.steamid}`;
}

let crazyGamesKey = null;
let crazyGamesKeyFetchedAt = 0;

async function crazyGamesPublicKey() {
  if (crazyGamesKey && Date.now() - crazyGamesKeyFetchedAt < 60 * 60 * 1000) {
    return crazyGamesKey;
  }

  const response = await axios.get('https://sdk.crazygames.com/publicKey.json', { timeout: 5000, maxRedirects: 0 });

  if (!response.data || typeof response.data.publicKey !== 'string') {
    throw { status: 503, message: 'CrazyGames sign in is not available right now.' };
  }

  crazyGamesKey = response.data.publicKey;
  crazyGamesKeyFetchedAt = Date.now();
  return crazyGamesKey;
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
  const parent = stmts.parentOf.get(child);

  // A key linked to a Steam account plays on it
  return parent ? parent.parent_id : child;
}

router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Access-Control-Allow-Origin', '*');

  const ip = clientIp(req);

  if (!allowRequest(ip)) {
    return res.status(429).send('Too many requests. Try again in a minute.');
  }

  if (!brokerKey) {
    return res.status(503).send('Signing in is not available right now.');
  }

  const { session, steam, crazygames, key, sig } = req.query;

  if (typeof session !== 'string' || !/^[0-9a-f]{64}$/.test(session)) {
    return res.status(400).send('Invalid request.');
  }

  const sessionPublicKey = Buffer.from(session, 'hex');

  try {
    const account = await (async () => {
      if (typeof steam === 'string' && /^[0-9a-f]{2,4096}$/.test(steam)) return steamAccount(steam, sessionPublicKey);
      if (typeof crazygames === 'string' && crazygames.length <= 4096) return crazyGamesAccount(crazygames);
      if (typeof key === 'string' && typeof sig === 'string') return keyAccount(key, sig, sessionPublicKey);
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

    res.type('text/plain').send(cert.toString('hex'));
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).send(err.message);
    }

    // Steam or CrazyGames unreachable, or something unexpected: the game retries later
    console.error('[broker] Could not issue a cert:', err && err.message ? err.message : err);
    res.status(502).send('Could not verify the account right now. Retrying soon.');
  }
});

module.exports = { router, steamTicketIdentity };
