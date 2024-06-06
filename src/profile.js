const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const axios = require('axios');

const dbPath = process.env.DB_PATH;

router.get('/', async (req, res) => {
  const db = new Database(dbPath);
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

  res.render('profile', {
    page: 'Profile',
    user: req.user,
    discordData
  });
});

module.exports = router;
