const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('./db');
const config = require('./config');

const linkKey = require('./link_key');

async function renderProfile(req, res, extra = {}) {
  const steamId = `steam_${req.user.id}`;
  const association = db.prepare("SELECT child_id FROM associations WHERE parent_id = ? AND child_id LIKE 'discord_%'").get(steamId);
  
  let discordData = null;
  if (association) {
    const discordId = association.child_id.split('_')[1];
    try {
      const response = await axios.get(`https://discord.com/api/users/${discordId}`, {
        headers: { 'Authorization': `Bot ${config.DISCORD_BOT_TOKEN}` }
      });
      discordData = response.data;
    } catch (error) {
      console.error('Error fetching Discord user data:', error.message);
    }
  }
  
  res.render('profile', {
    page: 'Profile',
    user: req.user,
    discordData,
    linkedKeys: linkKey.linkedKeys(steamId),
    success: req.query.success === 'true',
    is_admin: config.ADMIN_IDS.includes(req.user.id),
    ...extra
  });
}

router.get('/', (req, res) => renderProfile(req, res));

// The code to link a game key, alone on /link - see link_key.js. Never cached: it is this session's.
function renderLink(req, res, linkCode) {
  res.set('Cache-Control', 'no-store');

  res.render('link', {
    page: 'Link a game key',
    user: req.user,
    linkCode: linkCode.code,
    linkCodeExpires: linkCode.expires
  });
}

// GET /link: this Steam account's live code, or a new one
function linkPage(req, res) {
  renderLink(req, res, linkKey.currentCode(`steam_${req.user.id}`, req.user.displayName));
}

// A new one-time code in place of the one shown on /link
router.post('/link_code', (req, res) => {
  const code = linkKey.createCode(`steam_${req.user.id}`, req.user.displayName);
  renderLink(req, res, { code, expires: linkKey.liveCode(code).expires });
});

router.post('/unlink_key', (req, res) => {
  const child = String(req.body.key || '');

  if (/^key_[0-9a-f]{64}$/.test(child)) {
    linkKey.unlink(child, `steam_${req.user.id}`);
  }

  res.redirect('/profile');
});

module.exports = router;
module.exports.linkPage = linkPage;