const express = require('express');
const session = require('express-session');
const BetterSqlite3Store = require('better-sqlite3-session-store')(session);
const passport = require('../passport');
const db = require('../db');
const config = require('../config');

module.exports = (app) => {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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