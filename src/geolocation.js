const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../config');

router.get('/', async (req, res) => {
  try {
    const url = `https://ipinfo.io/${req.ip}/json?token=${config.IPINFO_TOKEN}`;
    const response = await axios.get(url, {
      headers: { 'Accept': 'application/json' }
    });
    res.json({ loc: response.data.loc });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch geolocation data' });
  }
});

module.exports = router;