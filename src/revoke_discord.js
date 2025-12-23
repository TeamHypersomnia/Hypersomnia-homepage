const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('./config');

router.post('/', async (req, res) => {
  const { access_token } = req.body;
  
  const data = new URLSearchParams({
    token: access_token,
    token_type_hint: 'access_token',
    client_id: config.DISCORD_CLIENT_ID,
    client_secret: config.DISCORD_CLIENT_SECRET
  }).toString();
  
  try {
    await axios.post('https://discord.com/api/v10/oauth2/token/revoke', data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    res.json({ success: true, message: 'Token revoked successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to revoke token' });
  }
});

module.exports = router;