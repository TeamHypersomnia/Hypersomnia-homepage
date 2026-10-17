const crypto = require('crypto');
const express = require('express');
const { makeLimiter } = require('./limiter');
const { clientIp } = require('./client_ip');
const db = require('./db');
const identityCert = require('./identity_cert');
const { verifySignature } = identityCert;
const { parentOf } = require('./ranked_rules');
const { accountLabel } = require('./utils');
const config = require('./config');

/*
  Linking an identity key (the account of a player without Steam, "key_<public key in hex>")
  to a Steam account, so that the progress from ranked matches played with the key counts towards the Steam account.

  1. The game makes a random state, signs "hypersomnia-link-v1 <state> <unix time>" with the key and opens
     /link_key/start?state&t&key&sig - good for LINK_PAGE_LIFETIME_SECS from when it is first opened.
  2. Signed in through Steam anew (every link - a session left on a shared computer links nothing), the player confirms
     the Steam account there - the key is linked at once.
  3. The game learns it from its own /cert (asked every few seconds while it waits): a cert for the Steam account.
     A refusal (another account's key, too many keys, a ban) is told on the page only.

  Unlinking from the game is GET /link_key/unlink signed by the key - no browser. The Steam account's owner unlinks
  on /profile.

  A link or unlink of a key is remembered by its time (key_link_changes): a signed page or request not newer than the
  last change does nothing - a link page used once and sent again later (a browser's history) links nothing.

  Linking moves no progress: the key's matches count towards the Steam account from then on - whoever confirmed a page
  they should not have (its address seen on a stream) gains nothing, and the game asks its player whether that Steam
  account is theirs (a refusal is an unlink).

  The signature proves the key's owner started it, the Steam session which account it goes to, so nobody can link
  someone else's key, or link their own key to someone else's Steam account (short of being sent a link and confirming
  it - the page warns). A key linked to one Steam account is not moved to another in the browser -
  it has to be unlinked there first. The Steam build never links its key - its certs come by a Steam ticket.
*/

const router = express.Router();

// The web build of the game runs on another origin: its unlink needs no cookies - the key's signature is the proof
router.use(['/unlink'], (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'no-store');
  next();
});

const MAX_KEYS_PER_STEAM_ACCOUNT = 32;

/*
  A link page is good for a few minutes from when it is first opened - whoever else sees its address (a stream, a shared
  computer) could confirm it with their own Steam account - counted by this server's clock, so a game's clock that is off
  does not matter. The game's signed time only has to be roughly right (a clock behind or ahead by minutes still links),
  as an unlink's.
*/
const LINK_PAGE_LIFETIME_SECS = 3 * 60;
const SIGNED_TIME_LIFETIME_SECS = 15 * 60;
const CLOCK_SLACK_SECS = 10 * 60;

const expiredLink = 'This link is too old (or the clock of your computer is off). Start again in the game: Settings - Account - Link with Steam.';
const usedLink = 'This link was used already. Start again in the game: Settings - Account - Link with Steam.';
const invalidLink = 'This link is not valid. Start again in the game: Settings - Account - Link with Steam.';

const stmts = {
  link: db.prepare('INSERT OR IGNORE INTO associations (child_id, parent_id) VALUES (?, ?)'),
  unlink: db.prepare('DELETE FROM associations WHERE child_id = ? AND parent_id = ?'),
  linkedKeys: db.prepare("SELECT child_id FROM associations WHERE parent_id = ? AND child_id LIKE 'key_%' ORDER BY child_id"),
  banned: db.prepare('SELECT reason FROM broker_bans WHERE account = ?'),
  forgetDevice: db.prepare('DELETE FROM key_devices WHERE child_id = ?'),
  setLinkMeta: db.prepare('INSERT OR REPLACE INTO key_devices (child_id, device, os, last_cert_at) VALUES (?, ?, ?, ?)'),
  touchKey: db.prepare('UPDATE key_devices SET last_cert_at = ? WHERE child_id = ?'),
  linkMetaOf: db.prepare('SELECT device, os, last_cert_at FROM key_devices WHERE child_id = ?'),
  ban: db.prepare('INSERT OR IGNORE INTO broker_bans (account, reason) VALUES (?, ?)'),
  changedAt: db.prepare('SELECT changed_at FROM key_link_changes WHERE child_id = ?'),
  setChangedAt: db.prepare(`INSERT INTO key_link_changes (child_id, changed_at) VALUES (?, ?)
    ON CONFLICT(child_id) DO UPDATE SET changed_at = MAX(changed_at, excluded.changed_at)`)
};

/*
  The time of a key's last link or unlink - the game's own time (its signed t) when the game made the change, the site's
  time less the clock slack when /profile did: a game whose clock is a few minutes behind still links again right after.
  Only ever grows.
*/
function changedAt(child) {
  const row = stmts.changedAt.get(child);
  return row ? row.changed_at : 0;
}

function newerThanLastChange(child, t) {
  return Number(t) > changedAt(child);
}

// The device the game runs on, as it names it, and its system - shown next to a linked key on its owner's /profile only
function deviceOf(query) {
  const device = typeof query.device === 'string'
    ? query.device.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 64) || null
    : null;

  const os = ['windows', 'linux', 'mac', 'web'].includes(query.os) ? query.os : null;

  return { device, os };
}

function linkedKeys(steamId) {
  return stmts.linkedKeys.all(steamId).map(row => row.child_id);
}

/*
  Links the key to the signed-in Steam account - a refusal is an { error, conflict } for the result page.
*/
function linkKey(publicKey, steamId, device, os, t) {
  const child = `key_${publicKey}`;

  try {
    if (stmts.banned.get(child)) {
      return { error: 'This key is banned.' };
    }

    if (stmts.banned.get(steamId)) {
      return { error: 'This Steam account is banned.' };
    }

    const parent = parentOf(child);

    if (parent && parent !== steamId) {
      return { error: 'This key is already linked to another Steam account. Unlink it there first.', conflict: true };
    }

    // Every new device or browser is a new key: many are fine, an endless stream is not
    if (!parent && linkedKeys(steamId).length >= MAX_KEYS_PER_STEAM_ACCOUNT) {
      return { error: `This Steam account already has ${MAX_KEYS_PER_STEAM_ACCOUNT} keys linked.\nUnlink the ones you no longer use.`, conflict: true };
    }

    if (!parent) {
      db.transaction(() => {
        stmts.link.run(child, steamId);
        stmts.setLinkMeta.run(child, device, os, Math.floor(Date.now() / 1000));
        stmts.setChangedAt.run(child, Number(t));
      })();
    }
    else {
      // Linked to this account already: its link stays as it is
      touchKey(child);
    }
  } catch (err) {
    console.error(`[link_key] Could not link ${child}:`, err && err.message ? err.message : err);
    return { error: 'Could not link right now. Try again in a moment.' };
  }

  console.log(`[link_key] Linked ${child} to ${steamId}.`);
  return { linked: steamId };
}

/*
  Every unlink - by the key's signature or by the Steam account on /profile: only the link goes - the progress stays where it
  is - and a key does not get out of its Steam account's ban by leaving it.
*/
function unlinkKey(child, steamId, changeTime = Math.floor(Date.now() / 1000) - CLOCK_SLACK_SECS) {
  db.transaction(() => {
    // Not this account's key (e.g. anyone's key posted to /profile/unlink_key): nothing else may be touched - not its
    // link, and above all no ban of this account carried over to it
    if (stmts.unlink.run(child, steamId).changes === 0) {
      return;
    }

    stmts.forgetDevice.run(child);
    stmts.setChangedAt.run(child, changeTime);

    const parentBan = stmts.banned.get(steamId);

    if (parentBan) {
      stmts.ban.run(child, parentBan.reason || 'Banned.');
    }
  })();
}

/*
  "Link with Steam": the game opens /link_key/start?state&t&key&sig (&device&os) in the browser - nothing goes back through the browser,
  so it works the same natively, in a tab or in an iframe. A link to this page someone else made carries their key:
  confirmed, it would link their key to the Steam account of whoever confirmed - the page warns in red.
*/
// The game's state, its public key, its signature of the state and the device it runs on (shown on the confirm page)
function startParams(query) {
  const { state, t, key, sig } = query || {};

  if (typeof state !== 'string' || !/^[0-9a-f]{32}$/.test(state)
    || typeof t !== 'string' || !/^[0-9]{1,12}$/.test(t)
    || typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key)
    || typeof sig !== 'string' || !/^[0-9a-f]{128}$/.test(sig)
  ) {
    return null;
  }

  const { device, os } = deviceOf(query);
  const deviceQuery = (device ? `&device=${encodeURIComponent(device)}` : '') + (os ? `&os=${os}` : '');

  return { state, t, key, sig, device, os, path: `/link_key/start?state=${state}&t=${t}&key=${key}&sig=${sig}${deviceQuery}` };
}

function signedByKey(params) {
  return verifySignature(params.key, `hypersomnia-link-v1 ${params.state} ${params.t}`, params.sig);
}

function linkUrlExpired(params) {
  const age = Math.floor(Date.now() / 1000) - Number(params.t);
  return age > SIGNED_TIME_LIFETIME_SECS || age < -CLOCK_SLACK_SECS;
}

/*
  A link page belongs to the browser that opened it first - the game opens it at once, so whoever else gets its address
  (a stream, a screenshot) is always second and is refused. The browser is told by a cookie of its own (a session is
  made anew at the sign-in through Steam). Its few minutes count from that first opening.
*/
const LINK_BROWSER_COOKIE = 'hs_link_browser';
const linkPages = new Map();

function browserOf(req) {
  const cookie = String(req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(LINK_BROWSER_COOKIE + '='));
  const value = cookie ? cookie.slice(LINK_BROWSER_COOKIE.length + 1) : '';
  return /^[0-9a-f]{32}$/.test(value) ? value : null;
}

// What is wrong with this page for this browser, or null - opening it first makes it this browser's
function linkPageRefusal(req, res, params) {
  const now = Date.now();

  for (const [state, page] of linkPages) {
    if (now - page.at > SIGNED_TIME_LIFETIME_SECS * 1000) linkPages.delete(state);
  }

  let browser = browserOf(req);

  if (!linkPages.has(params.state)) {
    if (!browser) {
      browser = crypto.randomBytes(16).toString('hex');
      res.cookie(LINK_BROWSER_COOKIE, browser, { httpOnly: true, sameSite: 'lax', secure: config.IS_PROD, maxAge: SIGNED_TIME_LIFETIME_SECS * 1000 });
    }

    linkPages.set(params.state, { at: now, browser });
  }

  const page = linkPages.get(params.state);

  if (browser !== page.browser) {
    return 'This link page was opened in another browser first. Start again in the game: Settings - Account - Link with Steam.';
  }

  if (now - page.at > LINK_PAGE_LIFETIME_SECS * 1000) {
    return expiredLink;
  }

  return null;
}

// A POST that changes an account only from this site's own pages (on top of the session cookie's SameSite)
function fromThisSite(req) {
  const origin = req.headers.origin;
  return !origin || origin === new URL(config.BASE_URL).origin;
}

// A page saying what happened: linked (200 - the game finishes it), or an error
function renderResult(res, status, message, title = 'Error') {
  const ok = status === 200;
  res.status(status).render('link_result', { page: title, user: res.req.user, ok, title, message });
}

/*
  Signed in through Steam anew for this very page (a session on a shared browser may be someone else's), the player
  confirms which Steam account to link to. The link is made only by this page's POST (a cross-site form does not carry
  the session cookie).
*/
function freshlySignedInFor(req, params) {
  return req.user && req.session.fresh_link_state === params.state;
}

// Every GET may make a session (the sign-in comes back to this page) - a script can not fill the database with them
const allowStartPage = makeLimiter({ perAddress: 20 });

router.get('/start', (req, res) => {
  if (!allowStartPage(clientIp(req))) {
    return renderResult(res, 429, 'Too many attempts. Try again in a minute.');
  }

  const params = startParams(req.query);

  if (!params || !signedByKey(params)) {
    return renderResult(res, 400, invalidLink);
  }

  if (linkUrlExpired(params)) {
    return renderResult(res, 400, expiredLink);
  }

  if (!newerThanLastChange(`key_${params.key}`, params.t)) {
    return renderResult(res, 409, usedLink);
  }

  const refusal = linkPageRefusal(req, res, params);

  if (refusal) {
    return renderResult(res, 400, refusal);
  }

  if (!freshlySignedInFor(req, params)) {
    req.session.link_page = params.path;
    return res.redirect('/auth/steam/link');
  }

  res.set('Cache-Control', 'no-store');

  res.render('link_confirm', {
    page: 'Link the game to Steam',
    user: req.user,
    steamName: req.user.displayName,
    steamId: req.user.id,
    state: params.state,
    key: params.key,
    keyLabel: accountLabel(`key_${params.key}`),
    sig: params.sig,
    t: params.t,
    device: params.device,
    os: params.os
  });
});

const allowStart = makeLimiter({ perAddress: 10 });

router.post('/start', (req, res) => {
  const params = startParams(req.body);

  res.set('Cache-Control', 'no-store');

  if (!allowStart(clientIp(req))) {
    return renderResult(res, 429, 'Too many attempts. Try again in a minute.');
  }

  if (!params || !signedByKey(params) || !fromThisSite(req)) {
    return renderResult(res, 400, invalidLink);
  }

  if (!freshlySignedInFor(req, params)) {
    return renderResult(res, 400, 'Sign in through Steam on this page again. Start again in the game: Settings - Account - Link with Steam.');
  }

  if (linkUrlExpired(params)) {
    return renderResult(res, 400, expiredLink);
  }

  const refusal = linkPageRefusal(req, res, params);

  if (refusal) {
    return renderResult(res, 400, refusal);
  }

  // A page links once - the same page sent again does nothing more
  if (!newerThanLastChange(`key_${params.key}`, params.t)) {
    return renderResult(res, 409, usedLink);
  }

  delete req.session.fresh_link_state;

  const steamId = `steam_${req.user.id}`;
  const result = linkKey(params.key, steamId, params.device, params.os, params.t);

  if (result.error) {
    return renderResult(res, result.conflict ? 409 : 403, result.error);
  }

  renderResult(res, 200, 'This tab can be closed now.', 'You can go back to Hypersomnia');
});

/*
  "Unlink from Steam" in the game: a GET (all the web build can make) of key, t and the key's signature of
  "hypersomnia-unlink-v1 <t>" - answered at once, {"unlinked": true} (also when it was not linked) or {"error"}. Only the
  key's owner can; one not newer than the key's last change (the same request again) does nothing.
*/
const allowUnlink = makeLimiter({ perAddress: 10 });

router.get('/unlink', (req, res) => {
  if (!allowUnlink(clientIp(req))) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
  }

  const { t, key, sig } = req.query || {};

  if (typeof t !== 'string' || !/^[0-9]{1,12}$/.test(t)
    || typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key)
    || typeof sig !== 'string' || !/^[0-9a-f]{128}$/.test(sig)
    || !verifySignature(key, `hypersomnia-unlink-v1 ${t}`, sig)
  ) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  if (linkUrlExpired({ t })) {
    return res.status(400).json({ error: 'The clock of your computer is off. You can also unlink at hypersomnia.io/profile.' });
  }

  const child = `key_${key}`;

  if (!newerThanLastChange(child, t)) {
    return res.status(409).json({ error: 'This request was sent already.' });
  }

  const parent = parentOf(child);

  try {
    if (parent) {
      unlinkKey(child, parent, Number(t));
    }
    else {
      stmts.setChangedAt.run(child, Number(t));
    }
  } catch (err) {
    console.error(`[link_key] Could not unlink ${child}:`, err && err.message ? err.message : err);
    return res.status(503).json({ error: 'Could not unlink right now. Try again in a moment.' });
  }

  if (parent) {
    console.log(`[link_key] Unlinked ${child} from ${parent.parent_id} (from the game).`);
  }

  res.json({ unlinked: true });
});

// When a linked key last got a cert - its device and system are kept from the link
function touchKey(child) {
  stmts.touchKey.run(Math.floor(Date.now() / 1000), child);
}

function linkMetaOf(child) {
  return stmts.linkMetaOf.get(child) || null;
}

module.exports = { router, linkedKeys, unlink: unlinkKey, touchKey, linkMetaOf, fromThisSite };
