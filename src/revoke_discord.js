const express = require('express');
const axios = require('axios');
const cors = require('cors');
const router = express.Router();

// Configure CORS
const corsOptions = {
    origin: 'http://localhost:6931',  // Allow only this origin or use '*' to allow all
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

router.use(cors(corsOptions));  // Use CORS middleware

const API_ENDPOINT = 'https://discord.com/api/v10';
const CLIENT_ID = '1189671952479158403';
const CLIENT_SECRET = process.env.DISCORD_SECRET;  // Ensure this is set in your environment variables

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
