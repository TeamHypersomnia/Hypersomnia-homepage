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
    linkCode: null,
    success: req.query.success === 'true',
    is_admin: config.ADMIN_IDS.includes(req.user.id),
    ...extra
  });
}

router.get('/', (req, res) => renderProfile(req, res));

// A one-time code for the game to link an identity key to this Steam account - see link_key.js
router.post('/link_code', (req, res) => {
  const code = linkKey.createCode(`steam_${req.user.id}`);
  renderProfile(req, res, { linkCode: code });
});

router.post('/unlink_key', (req, res) => {
  const child = String(req.body.key || '');

  if (/^key_[0-9a-f]{64}$/.test(child)) {
    linkKey.unlink(child, `steam_${req.user.id}`);
  }

  res.redirect('/profile');
});

module.exports = router;