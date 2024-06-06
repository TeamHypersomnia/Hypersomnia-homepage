const express = require('express');
const router = express.Router();
const fs = require('fs');
const UAParser = require('ua-parser-js');
const path = `${__dirname}/../private/users.json`;

const Database = require('better-sqlite3');
const axios = require('axios');
const querystring = require('querystring');

const dbPath = process.env.DB_PATH;

const discordClientId = process.env.DISCORD_CLIENT_ID;
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
const redirectUri = process.env.URL + 'auth/discord/return';

function loadUsers() {
  try {
    const d = fs.readFileSync(path, 'utf8');
    const obj = JSON.parse(d);
    return obj;
  } catch (error) {
    console.error(error.message);
    return {};
  }
}

function saveUsers(obj) {
  try {
    const json = JSON.stringify(obj, null, 2);
    fs.writeFileSync(path, json, 'utf8');
  } catch (error) {
    console.error(error.message);
  }
}

module.exports = function(passport) {
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
      const parser = new UAParser();
      const userAgent = req.headers['user-agent'];
      const result = parser.setUA(userAgent).getResult();
      const data = {
        name: req.user.displayName,
        lastLogin: Math.floor(Date.now() / 1000),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        os: result.os,
        browser: result.browser
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
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    res.redirect(authUrl);
  });

  // Route to disconnect Discord account
  router.post('/discord/disconnect', async (req, res) => {
    const db = new Database(dbPath);
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
        client_id: discordClientId,
        client_secret: discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
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
        client_id: discordClientId,
        client_secret: discordClientSecret
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Store the association in the database
      const db = new Database(dbPath);

      const discordId = 'discord_' + discordUser.id;
      const steamId = 'steam_' + req.user.id;

      console.log("d: " + discordUser.id + " s: " + steamId);

      const existingAssociation = db.prepare('SELECT * FROM associations WHERE child_id = ?').get(discordId);

      if (!existingAssociation) {
        db.prepare('INSERT OR REPLACE INTO associations (child_id, parent_id) VALUES (?, ?)').run(discordId, steamId);
      } else {
        console.log('Association already exists for Discord ID: ' + discordUser.id);
      }

      // Redirect to profile
      res.redirect('/profile');
    } catch (error) {
      console.error(error.message);
      res.redirect('/profile');
    }
  });

  return router;
};
