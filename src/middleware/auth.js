const config = require('../config');

const authenticated = (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect('/auth/steam');
  next();
};

const admin = (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect('/auth/steam');
  if (!config.ADMIN_IDS.includes(req.user.id)) return res.redirect('/');
  next();
};

module.exports = { authenticated, admin };