const express = require('express');
const router = express.Router();
const axios = require('axios');
const querystring = require('querystring');
const db = require('./db');
const config = require('./config');

const DISCORD_REDIRECT_URI = `${config.BASE_URL}auth/discord/return`;

const stmts = {
  upsertUser: db.prepare(`
    INSERT INTO users (id, name, last_login, ip, user_agent, user_lang) 
    VALUES (?, ?, unixepoch(), ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name, 
      last_login = unixepoch(), 
      ip = excluded.ip,
      user_agent = excluded.user_agent,
      user_lang = excluded.user_lang
  `),
  getAssoc: db.prepare('SELECT * FROM associations WHERE child_id = ?'),
  setAssoc: db.prepare('INSERT OR REPLACE INTO associations (child_id, parent_id) VALUES (?, ?)'),
  delAssoc: db.prepare('DELETE FROM associations WHERE parent_id = ?')
};

module.exports = (passport) => {
  
  // Steam authentication
  router.get('/steam', passport.authenticate('steam', { failureRedirect: '/' }));
  
  router.get('/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => {
    try {
      stmts.upsertUser.run(
        req.user.id,
        req.user.displayName,
        req.ip,
        req.get('user-agent') || null,
        req.get('accept-language')?.split(',')[0] || null
      );
      res.redirect('/profile');
    } catch (err) {
      console.error('DB Error:', err.message);
      res.redirect('/profile?error=db_fail');
    }
  });
  
  // Discord OAuth
  router.get('/discord', (req, res) => {
    if (!req.user) {
      return res.redirect('/?error=login_required');
    }
    
    const authUrl = 'https://discord.com/api/oauth2/authorize?' + querystring.stringify({
      client_id: config.DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify'
    });
    res.redirect(authUrl);
  });
  
  router.get('/discord/return', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
      return res.redirect('/profile?error=no_code');
    }
    
    if (!req.user) {
      return res.redirect('/?error=login_required');
    }
    
    try {
      // Exchange code for access token
      const tokenRes = await axios.post(
        'https://discord.com/api/oauth2/token', 
        querystring.stringify({
          client_id: config.DISCORD_CLIENT_ID,
          client_secret: config.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: DISCORD_REDIRECT_URI
        }), 
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      
      const { access_token } = tokenRes.data;
      
      // Get Discord user info
      const userRes = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      
      const discordId = `discord_${userRes.data.id}`;
      const steamId = `steam_${req.user.id}`;
      
      // Check if Discord account is already linked
      const existingAssoc = stmts.getAssoc.get(discordId);
      
      if (existingAssoc && existingAssoc.parent_id !== steamId) {
        // Discord account already linked to different Steam account
        res.redirect('/profile?error=discord_already_linked');
      } else {
        // Create or update association
        stmts.setAssoc.run(discordId, steamId);
        res.redirect('/profile?success=discord_linked');
      }
      
      // Revoke the access token (cleanup)
      axios.post('https://discord.com/api/oauth2/token/revoke', querystring.stringify({
        token: access_token,
        client_id: config.DISCORD_CLIENT_ID,
        client_secret: config.DISCORD_CLIENT_SECRET
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }).catch(() => {
        // Silently fail if revocation doesn't work
      });
      
    } catch (err) {
      console.error('Discord Auth Error:', err.response?.data || err.message);
      
      if (err.response?.status === 400) {
        res.redirect('/profile?error=invalid_code');
      } else {
        res.redirect('/profile?error=auth_fail');
      }
    }
  });
  
  router.post('/discord/disconnect', (req, res) => {
    if (!req.user) {
      return res.redirect('/?error=login_required');
    }
    
    try {
      const steamId = `steam_${req.user.id}`;
      stmts.delAssoc.run(steamId);
      res.redirect('/profile?success=discord_unlinked');
    } catch (err) {
      console.error('Discord Disconnect Error:', err.message);
      res.redirect('/profile?error=disconnect_fail');
    }
  });
  
  // Logout route
  router.get('/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout Error:', err.message);
      }
      res.redirect('/');
    });
  });
  
  return router;
};