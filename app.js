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
const servers = require('./src/servers');
const app = express();
const visitors = {};

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
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(session({
  store: new SQLiteStore({
    dir: __dirname + '/private',
    db: 'sessions.db',
    createDirIfNotExists: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 } // 1 year
}));

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

// Settings
const ts = Math.floor(Date.now() / 1000);
app.locals.version = ts;
app.locals.alert = '';
try {
  const content = fs.readFileSync(`./private/settings.json`, 'utf8');
  const obj = JSON.parse(content);
  app.locals.version = obj.version ? obj.version : ts;
  app.locals.alert = obj.alert ? obj.alert : '';
} catch (error) {
  console.error(error.message);
}

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
  const admins = process.env.ADMINS.split(',');
  if (!admins.includes(req.user.id)) {
    return res.redirect('/');
  }
  return next();
}

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ts = Math.floor(Date.now() / 1000);
  if (visitors.hasOwnProperty(ip)) {
    visitors[ip].lastSeen = ts;
  } else {
    const userAgent = req.headers['user-agent'] ?? '';
    visitors[ip] = { lastSeen: ts, ip, userAgent };
  }
  next();
});

// Timers
servers.fetchServers(app);
setInterval(() => servers.fetchServers(app), 10000);

// Routes
app.use('/', require('./src/index'));
app.use('/arenas', require('./src/arenas'));
app.use('/user', require('./src/user'));
app.use('/weapons', require('./src/weapons'));
app.use('/servers', servers.router);
app.use('/download', require('./src/download'));
app.use('/profile', usr, require('./src/profile'));
app.use('/logout', require('./src/logout'));
app.use('/auth', require('./src/auth')(passport));
app.use('/disclaimer', require('./src/disclaimer'));
app.use('/cookie-policy', require('./src/cookie_policy'));
app.get('/press', (req, res) => res.redirect('https://github.com/TeamHypersomnia/PressKit/blob/main/README.md#intro'));
app.get('/credits', (req, res) => res.redirect('https://teamhypersomnia.github.io/PressKit/credits'));
app.get('/steam', (req, res) => res.redirect('https://store.steampowered.com/app/2660970/Hypersomnia/'));
app.get('/discord', (req, res) => res.redirect('https://discord.com/invite/YC49E4G'));
app.get('/browser', (req, res) => res.redirect('https://hypersomnia.io'));
app.use('/upload', require('./src/upload'));
app.use('/report_match', require('./src/report_match'));
app.use('/revert_match', require('./src/revert_match'));
app.use('/adjust_negative_mmrs', require('./src/adjust_negative_mmrs'));
app.use('/revoke_discord', require('./src/revoke_discord'));
app.use('/geolocation', require('./src/geolocation'));
app.use('/leaderboards', require('./src/leaderboards'));
app.use('/matches', require('./src/matches'));
app.get('/admin', adm, (req, res) => res.redirect('/admin/system'));
app.use('/admin/system', adm, require('./src/admin/system'));
app.use('/admin/visitors', adm, require('./src/admin/visitors')(visitors));
app.use('/admin/users', adm, require('./src/admin/users'));
app.use('/admin/creators', adm, require('./src/admin/creators'));
app.use('/admin/settings', adm, require('./src/admin/settings')(app.locals));
app.use((req, res) => res.status(404).render('404', {
  page: 'Not Found',
  user: req.user
}));

// Start
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`App listening on port ${server.address().port}`);
});
