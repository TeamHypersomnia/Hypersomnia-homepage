const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('./db');
const axios = require('axios');
const querystring = require('querystring');

const DOMAIN = process.env.DOMAIN;
let url = `http://localhost:${process.env.PORT || 3000}/auth/discord/return`;
if (process.env.NODE_ENV == 'production') {
  url = `${DOMAIN}/auth/discord/return`;
}

function loadUsers() {
  try {
    const d = fs.readFileSync('./private/users.json', 'utf8');
    return JSON.parse(d);
  } catch (error) {
    console.error(error.message);
    return {};
  }
}

function saveUsers(obj) {
  try {
    const json = JSON.stringify(obj, null, 2);
    fs.writeFileSync('./private/users.json', json, 'utf8');
  } catch (error) {
    console.error(error.message);
  }
}

module.exports = function (passport) {
  router.get('/steam',
    passport.authenticate('steam', {
      failureRedirect: '/'
    }),
    function (req, res) {
      res.redirect('/profile');
    }
  );

  router.get('/steam/return',
    passport.authenticate('steam', {
      failureRedirect: '/'
    }),
    function (req, res) {
      const users = loadUsers();
      const data = {
        name: req.user.displayName,
        lastLogin: Math.floor(Date.now() / 1000),
        ip: req.ip
      };
      if (users.hasOwnProperty(req.user.id)) {
        Object.assign(users[req.user.id], data);
      } else {
        users[req.user.id] = data;
      }
      saveUsers(users);
      res.redirect('/profile');
    }
  );

  // Route to initiate Discord OAuth
  router.get('/discord', (req, res) => {
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${url}&response_type=code&scope=identify`;
    res.redirect(authUrl);
  });

  // Route to disconnect Discord account
  router.post('/discord/disconnect', async (req, res) => {
    const steamId = 'steam_' + req.user.id;

    try {
      db.prepare('DELETE FROM associations WHERE parent_id = ?').run(steamId);
      res.redirect('/profile');
    } catch (error) {
      console.error('Error disconnecting Discord account:', error.message);
      res.redirect('/profile');
    }
  });

  // Discord OAuth callback
  router.get('/discord/return', async (req, res) => {
    const { code } = req.query;

    if (!code) {
      return res.redirect('/profile');
    }

    try {
      // Exchange code for access token
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', querystring.stringify({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: url
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token } = tokenResponse.data;

      // Get user information from Discord
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      const discordUser = userResponse.data;

      await axios.post('https://discord.com/api/oauth2/token/revoke', querystring.stringify({
        token: access_token,
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Store the association in the database
      const discordId = 'discord_' + discordUser.id;
      const steamId = 'steam_' + req.user.id;

      console.log("d: " + discordUser.id + " s: " + steamId);

      const existingAssociation = db.prepare('SELECT * FROM associations WHERE child_id = ?').get(discordId);

      if (!existingAssociation) {
        db.prepare('INSERT OR REPLACE INTO associations (child_id, parent_id) VALUES (?, ?)').run(discordId, steamId);
      } else {
        console.log('Association already exists for Discord ID: ' + discordUser.id);
      }

      // Redirect to profile with success flag
      res.redirect('/profile?success=true');
    } catch (error) {
      console.error(error.message);
      res.redirect('/profile');
    }
  });

  return router;
};
