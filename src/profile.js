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
  
  // The code to link a game key, valid right away - see link_key.js. Never cached: it is this session's.
  const linkCode = linkKey.currentCode(steamId, req.user.displayName);
  res.set('Cache-Control', 'no-store');

  res.render('profile', {
    page: 'Profile',
    user: req.user,
    discordData,
    linkedKeys: linkKey.linkedKeys(steamId),
    linkCode: linkCode.code,
    linkCodeExpires: linkCode.expires,
    success: req.query.success === 'true',
    is_admin: config.ADMIN_IDS.includes(req.user.id),
    ...extra
  });
}

router.get('/', (req, res) => renderProfile(req, res));

// A new one-time code in place of the one shown (/profile shows one right away) - see link_key.js
router.post('/link_code', (req, res) => {
  linkKey.createCode(`steam_${req.user.id}`, req.user.displayName);
  renderProfile(req, res);
});

router.post('/unlink_key', (req, res) => {
  const child = String(req.body.key || '');

  if (/^key_[0-9a-f]{64}$/.test(child)) {
    linkKey.unlink(child, `steam_${req.user.id}`);
  }

  res.redirect('/profile');
});

module.exports = router;