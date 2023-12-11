require('dotenv').config();
const express = require('express');
const session = require('express-session');
const minifyHTML = require('express-minify-html-2');
const bodyParser = require('body-parser');
const settings = require(__dirname + '/src/admin/settings');
const passport = require('passport');
const passportSteam = require('passport-steam');
const SteamStrategy = passportSteam.Strategy;
const app = express();
const port = 3000;

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

passport.use(new SteamStrategy({
    returnURL: process.env.URL + 'auth/steam/return',
    realm: process.env.URL,
    apiKey: process.env.STEAM_APIKEY
  },
  function (identifier, profile, done) {
    process.nextTick(function () {
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));

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

app.locals = {
  arena: false,
  version: 3
};
const obj = settings.load();
app.locals.alert = obj.alert;

require(__dirname + '/src/routes')(app, passport);
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
