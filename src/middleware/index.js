const express = require('express');
const session = require('express-session');
const BetterSqlite3Store = require('better-sqlite3-session-store')(session);
const passport = require('../passport');
const db = require('../db');
const config = require('../config');

module.exports = (app) => {
  // The raw body is kept for the signatures over it (match reports) - see official_servers.js.
  // Parsed before any route checks who sent it, so no more than the biggest real one (a 64-player report) -
  // map uploads come as multipart (see upload.js), not through these.
  app.use(express.json({ limit: '256kb', verify: (req, res, buf) => { req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  app.use(session({
    store: new BetterSqlite3Store({
      client: db.getConnection(),
      expired: { clear: true, intervalMs: 900000 }
    }),
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 604800000,
      secure: config.IS_PROD,
      httpOnly: true,
      sameSite: 'lax'
    }
  }));
  app.use(passport.initialize());
  app.use(passport.session());
};