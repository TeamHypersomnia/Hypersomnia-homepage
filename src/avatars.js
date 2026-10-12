const express = require('express');
const db = require('./db');

/*
  The avatar catalog: one avatar per account, the one it had in its last match reported by an official server
  (what the players saw in game). The game server re-encodes avatars to PNG before reporting; anything that is not
  a small PNG is ignored. Shown on the profile pages, sent with key_ certs (broker.js), deleted by admins.

  GET /avatar/<account_id>.png
*/

const MAX_AVATAR_BYTES = 64 * 1024;
const MAX_AVATAR_SIDE = 80;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const router = express.Router();

const stmts = {
  get: db.prepare('SELECT png FROM avatars WHERE account_id = ?'),
  set: db.prepare('INSERT OR REPLACE INTO avatars (account_id, png, updated_at) VALUES (?, ?, ?)'),
  remove: db.prepare('DELETE FROM avatars WHERE account_id = ?'),
  recent: db.prepare('SELECT account_id, length(png) AS size, updated_at FROM avatars ORDER BY updated_at DESC LIMIT ?')
};

function isValidAccountId(id) {
  return typeof id === 'string' && (
    /^(steam|discord)_[0-9]{1,20}$/.test(id) ||
    /^crazygames_[A-Za-z0-9_-]{1,64}$/.test(id) ||
    /^key_[0-9a-f]{64}$/.test(id)
  );
}

/*
  The PNG bytes of a reported avatar (base64), or null if it is not a PNG of at most MAX_AVATAR_SIDE pixels a side
  and MAX_AVATAR_BYTES. Only the signature and the IHDR chunk are checked - browsers decode the rest, served as image/png.
*/
function parseAvatar(base64) {
  if (typeof base64 !== 'string' || base64.length === 0 || base64.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;

  const png = Buffer.from(base64, 'base64');

  if (png.length < 33 || png.length > MAX_AVATAR_BYTES) return null;
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (png.readUInt32BE(8) !== 13 || png.toString('latin1', 12, 16) !== 'IHDR') return null;

  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  if (width < 1 || height < 1 || width > MAX_AVATAR_SIDE || height > MAX_AVATAR_SIDE) return null;

  return png;
}

function getAvatar(accountId) {
  const row = stmts.get.get(accountId);
  return row ? row.png : null;
}

function setAvatar(accountId, png) {
  stmts.set.run(accountId, png, Math.floor(Date.now() / 1000));
}

function deleteAvatar(accountId) {
  return stmts.remove.run(accountId).changes > 0;
}

function recentAvatars(limit) {
  return stmts.recent.all(limit);
}

router.get('/:file', (req, res) => {
  const match = /^(.+)\.png$/.exec(req.params.file);
  const png = match && isValidAccountId(match[1]) ? getAvatar(match[1]) : null;

  if (!png) {
    return res.status(404).type('text/plain').send('No avatar.');
  }

  res.set('Content-Type', 'image/png');
  res.set('X-Content-Type-Options', 'nosniff');
  // Changes with the next reported match or an admin's deletion - an hour stale at most
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(png);
});

module.exports = { router, isValidAccountId, parseAvatar, getAvatar, setAvatar, deleteAvatar, recentAvatars };
