const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('./db');
const config = require('./config');

router.get('/', async (req, res) => {
  const steamId = `steam_${req.user.id}`;
  const association = db.prepare('SELECT child_id FROM associations WHERE parent_id = ?').get(steamId);
  
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
    success: req.query.success === 'true',
    is_admin: config.ADMIN_IDS.includes(req.user.id)
  });
});

module.exports = router;