const express = require('express');
const session = require('express-session');
const BetterSqlite3Store = require('better-sqlite3-session-store')(session);
const passport = require('../passport');
const db = require('../db');
const config = require('../config');

module.exports = (app) => {
  // The raw body is kept for the signatures over it (match reports) - see official_servers.js.
  // Parsed before any route checks who sent it, so small - only a match report is bigger (every player's avatar in it,
  // a few MB with 64 players); map uploads come as multipart (see upload.js), not through these.
  const keepRawBody = (req, res, buf) => { req.rawBody = buf; };
  const jsonOfReport = express.json({ limit: '8mb', verify: keepRawBody });
  const jsonOfAnything = express.json({ limit: '256kb', verify: keepRawBody });
  app.use((req, res, next) => (req.path === '/report_match' ? jsonOfReport : jsonOfAnything)(req, res, next));
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