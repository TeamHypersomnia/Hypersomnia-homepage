require('dotenv').config();

const Database = require('better-sqlite3');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const minifyHTML = require('express-minify-html-2');
const bodyParser = require('body-parser');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const app = express();
const visitors = {};
const admins = process.env.ADMINS.split(',');

if (!fs.existsSync(process.env.DB_PATH)) {
  console.log('Database does not exist, creating a new one...');
  const db = new Database(process.env.DB_PATH);
  db.prepare(`
    CREATE TABLE IF NOT EXISTS mmr_team (
      account_id TEXT UNIQUE,
      nickname TEXT,
      mmr FLOAT DEFAULT 0,
      mu FLOAT DEFAULT 0,
      sigma FLOAT DEFAULT 0,
      matches_won INTEGER DEFAULT 0,
      matches_lost INTEGER DEFAULT 0
    )
  `).run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS mmr_ffa (
      account_id TEXT UNIQUE,
      nickname TEXT,
      mmr FLOAT DEFAULT 0,
      mu FLOAT DEFAULT 0,
      sigma FLOAT DEFAULT 0,
      matches_won INTEGER DEFAULT 0,
      matches_lost INTEGER DEFAULT 0
    )
  `).run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS matches (
      match_id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_name TEXT,
      server_id TEXT,
      arena TEXT,
      game_mode TEXT,
      winners TEXT,
      losers TEXT,
      win_score INTEGER,
      lose_score INTEGER,
      event_match_multiplier FLOAT DEFAULT 1,
      match_start_date TIMESTAMP,
      match_end_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS associations (
      child_id TEXT UNIQUE,
      parent_id TEXT UNIQUE
    )
  `).run();
  db.close();
}

// Passport
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new SteamStrategy({
  returnURL: process.env.URL + 'auth/steam/return',
  realm: process.env.URL,
  apiKey: process.env.STEAM_APIKEY
}, (identifier, profile, done) => {
  process.nextTick(() => {
    profile.identifier = identifier;
    return done(null, profile);
  });
}));

// Configuration
app.use(session({
  store: new SQLiteStore({
    dir: __dirname + '/private',
    db: 'sessions.db',
    createDirIfNotExists: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));
app.set('trust proxy', true);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(minifyHTML({
  override: true,
  exceptionUrls: false,
  htmlMinifier: {
    removeComments: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeAttributeQuotes: true,
    removeEmptyAttributes: true
  }
}));
app.locals.version = Math.floor(Date.now() / 1000);
app.locals.alert = '';
app.locals.NODE_ENV = process.env.NODE_ENV || 'development';
app.locals.CDN = process.env.CDN || '';

// Middleware
function usr(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/steam');
  }
  return next();
}

function adm(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/steam');
  }
  if (!admins.includes(req.user.id)) {
    return res.redirect('/');
  }
  return next();
}

app.use((req, res, next) => {
  const url = req.originalUrl.replace(/\/\?$/, '').replace(/\?.*$/, '');
  visitors[req.ip] = {
    userAgent: req.headers['user-agent'] ?? '',
    lastSeen: Math.floor(Date.now() / 1000),
    lastUrl: url,
  }
  res.locals.ogUrl = `https://${req.hostname}${url}`;
  next();
});

// Routes
app.get('/', (req, res) => res.render('index', { page: false, user: req.user }));
app.get('/disclaimer', (req, res) => res.render('disclaimer', { page: 'Disclaimer', user: req.user }));
app.get('/cookie-policy', (req, res) => res.render('cookie_policy', { page: 'Cookie Policy', user: req.user }));
app.use('/weapons', require('./src/weapons'));
app.use('/leaderboards', require('./src/leaderboards'));
app.use('/matches', require('./src/matches'));
app.use('/arenas', require('./src/arenas'));
app.use('/servers', require('./src/servers'));
app.use('/user', require('./src/user'));
app.use('/auth', require('./src/auth')(passport));
app.use('/profile', usr, require('./src/profile'));
app.post('/logout', (req, res) => req.logout(() => res.redirect('/')));
app.use('/upload', require('./src/upload'));
app.use('/report_match', require('./src/report_match'));
app.use('/revert_match', require('./src/revert_match'));
app.use('/adjust_negative_mmrs', require('./src/adjust_negative_mmrs'));
app.use('/revoke_discord', require('./src/revoke_discord'));
app.use('/geolocation', require('./src/geolocation'));
app.use('/admin/system', adm, require('./src/admin/system'));
app.use('/admin/visitors', adm, require('./src/admin/visitors')(visitors));
app.use('/admin/users', adm, require('./src/admin/users'));
app.use('/admin/creators', adm, require('./src/admin/creators'));
app.use('/admin/settings', adm, require('./src/admin/settings')(app.locals));
app.use((req, res) => res.status(404).render('404', { page: 'Not Found', user: req.user }));

if (app.locals.NODE_ENV === 'production') {
  const uglifyJS = require('uglify-js');
  const uglifyCSS = require('uglifycss');
  const jsInput = __dirname + '/public/assets/scripts/main.js';
  const jsOutput = __dirname + '/public/assets/scripts/main.min.js';
  const jsCode = fs.readFileSync(jsInput, 'utf8');
  const minifiedJS = uglifyJS.minify(jsCode);
  fs.writeFileSync(jsOutput, minifiedJS.code);
  const cssInput = __dirname + '/public/assets/styles/main.css';
  const cssOutput = __dirname + '/public/assets/styles/main.min.css';
  const cssCode = fs.readFileSync(cssInput, 'utf8');
  const minifiedCSS = uglifyCSS.processString(cssCode);
  fs.writeFileSync(cssOutput, minifiedCSS);
}

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`App listening on port ${server.address().port}`);
});
