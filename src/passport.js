const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const config = require('./config');

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

function verified(identifier, profile, done) {
  profile.identifier = identifier;
  return done(null, profile);
}

passport.use(new SteamStrategy({
  returnURL: `${config.BASE_URL}auth/steam/return`,
  realm: config.BASE_URL,
  apiKey: config.STEAM_API_KEY
}, verified));

// The Steam sign-in of a game's link page (link_key.js) - its own way back, so the usual sign-in never ends on a link page
passport.use('steam-link', new SteamStrategy({
  returnURL: `${config.BASE_URL}auth/steam/link/return`,
  realm: config.BASE_URL,
  apiKey: config.STEAM_API_KEY
}, verified));

module.exports = passport;