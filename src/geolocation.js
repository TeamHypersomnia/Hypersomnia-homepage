const express = require('express');
const router = express.Router();
const { getLocation } = require('./utilities/geoloc');

router.get('/', async (req, res) => {
  try {
    const location = await getLocation(req.ip);
    if (location) {
      res.json({ loc: location });
    } else {
      res.status(404).json({
        success: false,
        message: 'Location data not available'
      });
    }
  } catch (error) {
    console.error('Geolocation API error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch geolocation data'
    });
  }
});

module.exports = router;