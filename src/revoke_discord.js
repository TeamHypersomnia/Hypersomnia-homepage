const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_ENDPOINT = 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

router.post('/', async (req, res) => {
    const { access_token } = req.body;

    const data = new URLSearchParams({
        token: access_token,
        token_type_hint: 'access_token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
    }).toString();

    try {
        const response = await axios.post(`${API_ENDPOINT}/oauth2/token/revoke`, data, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log("Discord revocation response: ", response.status);

        res.json({ success: true, message: 'Token revoked successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to revoke token', error: error.toString() });
    }
});

module.exports = router;
