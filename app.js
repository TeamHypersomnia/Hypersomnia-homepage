require('dotenv').config();

const express = require('express');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const Database = require('better-sqlite3');
const SQLiteStore = require('connect-sqlite3')(session);
const minifyHTML = require('express-minify-html-2');
const bodyParser = require('body-parser');
const SteamStrategy = require('passport-steam').Strategy;
const axios = require('axios');
const uglifyJS = require('uglify-js');
const uglifyCSS = require('uglifycss');
const app = express();

// Environment settings
app.locals.alert = '';
app.locals.version = Math.floor(Date.now() / 1000);
app.locals.NODE_ENV = process.env.NODE_ENV || 'development';
app.locals.CDN = process.env.CDN || '';

// Database setup
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

// Minification for production environment
if (process.env.NODE_ENV === 'production') {
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

  // Purge CDN cache if necessary
  if (process.env.BUNNYCDN_API) {
    axios.post('https://api.bunny.net/pullzone/3594361/purgeCache', {}, {
      headers: {
        'Content-Type': 'application/json',
        AccessKey: process.env.BUNNYCDN_API
      }
    })
    .then(res => {
      if (res.status === 204) {
        console.log('Cache was successfully purged');
      } else {
        console.log(`Unexpected status: ${res.status}`);
      }
    })
    .catch(err => {
      if (err.response) {
        console.error('Error response status:', err.response.status);
      } else {
        console.error('Error purging cache:', err.message);
      }
    });
  }
} else {
  app.locals.alert = 'Node environment is not set to production. If testing locally, it\'s fine, but set it to production for live deployment to ensure optimal performance and security.';
  app.use(express.static(__dirname + '/public'));
}

// Passport authentication setup
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
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

// Session management
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

// Express setup
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(passport.initialize());
app.use(passport.session());
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

// Middleware for user authentication
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
app.use('/admin/users', adm, require('./src/admin/users'));
app.use('/admin/creators', adm, require('./src/admin/creators'));
app.use('/admin/settings', adm, require('./src/admin/settings')(app.locals));

// 404 route
app.use((req, res) => res.status(404).render('404', { page: 'Not Found', user: req.user }));

// Start the server
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log(`App listening on port ${process.env.PORT || 3000}`);
});
