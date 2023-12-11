require('dotenv').config();

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
const app = express();
const port = 3000;
const visitors = {};

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
    visitors[ip] = {
      lastSeen: ts,
      ip: ip,
      os: result.os,
      browser: result.browser,
      referer: req.get('Referrer')
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
app.use('/upload', require('./src/upload'));
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
