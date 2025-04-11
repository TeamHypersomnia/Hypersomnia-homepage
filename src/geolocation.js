const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        console.log("Requesting geolocation for " + req.ip);
        const response = await axios.get(`https://ipinfo.io/${req.ip}/json?token=${process.env.IPINFO_API_TOKEN}`, {
            headers: {
                'Accept': 'application/json',
            }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch geolocation data', error: error.toString() });
    }
});

module.exports = router;
