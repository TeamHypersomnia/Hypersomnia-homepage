const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const config = require('./config');

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new SteamStrategy({
  returnURL: `${config.BASE_URL}auth/steam/return`,
  realm: config.BASE_URL,
  apiKey: config.STEAM_API_KEY
}, (identifier, profile, done) => {
  profile.identifier = identifier;
  return done(null, profile);
}));

module.exports = passport;