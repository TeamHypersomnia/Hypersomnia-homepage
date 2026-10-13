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
    // With what only the owner sees here: the device, how it was linked, when it last signed in
    linkedKeys: linkKey.linkedKeys(steamId).map(id => {
      const meta = linkKey.linkMetaOf(id) || {};
      return { id, device: meta.device || '', via: meta.linked_via || 'browser', lastCertAt: meta.last_cert_at || null };
    }),
    success: req.query.success === 'true',
    is_admin: config.ADMIN_IDS.includes(req.user.id),
    ...extra
  });
}

router.get('/', (req, res) => renderProfile(req, res));

// /link: where linking starts - in the game, which opens the sign-in through Steam by itself
function linkPage(req, res) {
  res.render('link', { page: 'Link a game key', user: req.user });
}

router.post('/unlink_key', (req, res) => {
  const child = String(req.body.key || '');

  if (/^key_[0-9a-f]{64}$/.test(child)) {
    linkKey.unlink(child, `steam_${req.user.id}`);
  }

  res.redirect('/profile');
});

module.exports = router;
module.exports.linkPage = linkPage;