const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const axios = require('axios');

router.get('/', async (req, res) => {
  const db = new Database(process.env.DB_PATH);
  const steamId = 'steam_' + req.user.id;
  const association = db.prepare('SELECT child_id FROM associations WHERE parent_id = ?').get(steamId);

  let discordData = null;
  if (association) {
    const discordId = association.child_id.split('_')[1];
    try {
      const response = await axios.get(`https://discord.com/api/users/${discordId}`, {
        headers: {
          'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`
        }
      });
      discordData = response.data;
    } catch (error) {
      console.error('Error fetching Discord user data:', error.message);
    }
  }

  const success = req.query.success === 'true';

  let is_admin = false;
  const admins = process.env.ADMINS.split(',');
  if (admins.includes(req.user.id)) {
    is_admin = true;
  }

  res.render('profile', {
    page: 'Profile',
    user: req.user,
    discordData,
    success,
    is_admin
  });
});

module.exports = router;
