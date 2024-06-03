const express = require('express');
const router = express.Router();
const fs = require('fs');
const UAParser = require('ua-parser-js');
const path = `${__dirname}/../private/users.json`;

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
      res.redirect('/');
    }
  );

  return router;
};
