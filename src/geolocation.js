const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const url = req.ip + '/json?token=' + process.env.IPINFO_API_TOKEN;
    const response = await axios.get('https://ipinfo.io/' + url, {
      headers: {
        'Accept': 'application/json',
      }
    });
    res.json({ loc: response.data.loc });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch geolocation data'
    });
  }
});

module.exports = router;
