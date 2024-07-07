const express = require('express');
const axios = require('axios');
const router = express.Router();

const IPINFO_TOKEN = process.env.IPINFO_API_TOKEN;

router.get('/', async (req, res) => {
    // Get client's IP address from request headers
    let clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Handle cases where the IP address might be in IPv6 format or contain multiple IPs
    if (clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0];
    }
    if (clientIp.includes('::ffff:')) {
        clientIp = clientIp.split('::ffff:')[1];
    }

    try {
        console.log("Requesting geolocation for " + clientIp);
        const response = await axios.get(`https://ipinfo.io/${clientIp}/json?token=${IPINFO_TOKEN}`, {
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
