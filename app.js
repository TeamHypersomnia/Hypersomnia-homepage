require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SQLiteStore = require('connect-sqlite3')(session);
const minifyHTML = require('express-minify-html-2');
const bodyParser = require('body-parser');
const SteamStrategy = require('passport-steam').Strategy;
const app = express();
const admins = process.env.ADMINS.split(',');

const DOMAIN = process.env.DOMAIN;
app.locals.url = DOMAIN;
app.locals.alert = '';
app.locals.version = Math.floor(Date.now() / 1000);
if (process.env.NODE_ENV != 'production') {
  app.locals.url = `http://localhost:${process.env.PORT || 3000}/`;
  app.locals.alert =
    'NODE_ENV is not set to production. If testing locally, ' +
    'it\'s fine, but set it to production for live deployment.';
  app.use(express.static('./public'));
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new SteamStrategy({
  returnURL: `${app.locals.url}auth/steam/return`,
  realm: app.locals.url,
  apiKey: process.env.STEAM_APIKEY
}, (identifier, profile, done) => {
  process.nextTick(() => {
    profile.identifier = identifier;
    return done(null, profile);
  });
}));

app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(session({
  store: new SQLiteStore({
    dir: './private',
    db: 'sessions.db',
    createDirIfNotExists: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(minifyHTML({ override: true }));

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
app.use('/admin', adm, require('./src/admin/overview'));
app.use('/admin/users', adm, require('./src/admin/users'));
app.use('/admin/creators', adm, require('./src/admin/creators'));
app.use('/admin/settings', adm, require('./src/admin/settings')(app.locals));
app.use((req, res) => res.status(404).render('404', { page: 'Not Found', user: req.user }));

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log(`App listening on port ${process.env.PORT || 3000}`);
});
