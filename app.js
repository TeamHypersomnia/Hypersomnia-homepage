require('dotenv').config();

const sqlite3 = require('sqlite3');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const minifyHTML = require('express-minify-html-2');
const bodyParser = require('body-parser');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const UAParser = require('ua-parser-js');

const github = 'https://github.com/TeamHypersomnia';
const pressKit = `${github}/PressKit/blob/main/README.md#intro`;
const credits = `https://teamhypersomnia.github.io/PressKit/credits`
const steam = `https://store.steampowered.com/app/2660970/Hypersomnia/`
const discord = `https://discord.com/invite/YC49E4G`
const app = express();
const port = 3000;
const visitors = {};

const dbPath = process.env.DB_PATH;

// Check if the database file exists, if not, initialize it
if (!fs.existsSync(dbPath)) {
  const db = new sqlite3.Database(dbPath);

  // Create the players table if it doesn't exist
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS players (
        account_id TEXT UNIQUE,
        nickname TEXT,
        mmr FLOAT DEFAULT 0,
        mu FLOAT DEFAULT 0,
        sigma FLOAT DEFAULT 0,
        matches_won INTEGER DEFAULT 0,
        matches_lost INTEGER DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS matches (
        match_id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_name TEXT,
        arena TEXT,
        game_mode TEXT,
        winners TEXT,
        losers TEXT,
        win_score INTEGER,
        lose_score INTEGER,
        match_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  // Close the database connection
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
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true
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
    const parser = new UAParser();
    const userAgent = req.headers['user-agent'];
    const result = parser.setUA(userAgent).getResult();
    const referer = req.get('Referer');
    let origin = '';
    if (referer) {
      try {
        const url = new URL(referer);
        origin = url.origin;
      } catch (error) {
        console.error(error.message);
      }
    }
    visitors[ip] = {
      lastSeen: ts,
      ip: ip,
      os: result.os,
      browser: result.browser,
      referer: origin
    };
  }
  next();
});

// Routes
app.use('/', require('./src/index'));
app.use('/guide', require('./src/guide'));
app.use('/arenas', require('./src/arenas'));
app.use('/weapons', require('./src/weapons'));
app.use('/servers', require('./src/servers'));
app.use('/profile', usr, require('./src/profile'));
app.use('/logout', require('./src/logout'));
app.use('/auth', require('./src/auth')(passport));
app.use('/disclaimer', require('./src/disclaimer'));
app.use('/cookie-policy', require('./src/cookie_policy'));
app.use('/contact', require('./src/contact'));
app.get('/press', (req, res) => res.redirect(pressKit));
app.get('/credits', (req, res) => res.redirect(credits));
app.get('/steam', (req, res) => res.redirect(steam));
app.get('/discord', (req, res) => res.redirect(discord));
app.use('/upload', require('./src/upload'));
app.use('/report_match', require('./src/report_match'));
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
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
