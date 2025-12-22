const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');
const querystring = require('querystring');

// Set OAuth callback URL based on environment
const REDIRECT_URI = process.env.NODE_ENV === 'production' ?
  `${process.env.DOMAIN}/auth/discord/return` :
  `http://localhost:${process.env.PORT || 3000}/auth/discord/return`;

// Pre-compiled SQL statements for high performance
const stmts = {
  upsertUser: db.prepare(`
    INSERT INTO users (id, name, lastLogin, ip) 
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name, 
      lastLogin = excluded.lastLogin, 
      ip = excluded.ip
  `),
  getAssoc: db.prepare('SELECT * FROM associations WHERE child_id = ?'),
  setAssoc: db.prepare('INSERT OR REPLACE INTO associations (child_id, parent_id) VALUES (?, ?)'),
  delAssoc: db.prepare('DELETE FROM associations WHERE parent_id = ?')
};

module.exports = function(passport) {
  
  router.get('/steam', passport.authenticate('steam', { failureRedirect: '/' }));
  
  router.get('/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => {
    try {
      // Sync login data to SQLite users table
      stmts.upsertUser.run(
        req.user.id,
        req.user.displayName,
        Math.floor(Date.now() / 1000),
        req.ip
      );
      res.redirect('/profile');
    } catch (err) {
      console.error('Login DB Error:', err.message);
      res.redirect('/profile?error=db_fail');
    }
  });
  
  router.get('/discord', (req, res) => {
    const authUrl = `https://discord.com/api/oauth2/authorize?` + querystring.stringify({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'identify'
    });
    res.redirect(authUrl);
  });
  
  router.get('/discord/return', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/profile');
    
    try {
      // Exchange code for access token
      const tokenRes = await axios.post('https://discord.com/api/oauth2/token', querystring.stringify({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      
      const { access_token } = tokenRes.data;
      
      const userRes = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      
      const discordId = `discord_${userRes.data.id}`;
      const steamId = `steam_${req.user.id}`;
      
      // Save linkage between accounts
      if (!stmts.getAssoc.get(discordId)) {
        stmts.setAssoc.run(discordId, steamId);
      }
      
      // Cleanup token session on Discord side
      axios.post('https://discord.com/api/oauth2/token/revoke', querystring.stringify({
        token: access_token,
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET
      })).catch(() => {});
      
      res.redirect('/profile?success=true');
    } catch (err) {
      console.error('Discord Auth Error:', err.message);
      res.redirect('/profile?error=auth_fail');
    }
  });
  
  router.post('/discord/disconnect', (req, res) => {
    try {
      stmts.delAssoc.run(`steam_${req.user.id}`);
      res.redirect('/profile');
    } catch (err) {
      res.redirect('/profile');
    }
  });
  
  return router;
};