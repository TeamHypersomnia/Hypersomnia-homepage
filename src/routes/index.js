const passport = require('../passport');
const { authenticated, admin } = require('../middleware/auth');

module.exports = (app) => {
  app.get('/', (req, res) => res.render('index', { page: false, user: req.user }));
  app.get('/disclaimer', (req, res) => res.render('disclaimer', { page: 'Disclaimer', user: req.user }));
  app.get('/cookie-policy', (req, res) => res.render('cookie_policy', { page: 'Cookie Policy', user: req.user }));
  app.use('/weapons', require('../weapons'));
  app.use('/leaderboards', require('../leaderboards'));
  app.use('/matches', require('../matches'));
  app.use('/arenas', require('../arenas'));
  app.use('/servers', require('../servers'));
  app.use('/user', require('../user'));
  app.use('/auth', require('../auth')(passport));
  app.use('/profile', authenticated, require('../profile'));
  app.post('/logout', authenticated, (req, res) => req.logout(() => res.redirect('/')));
  app.use('/upload', require('../upload'));
  app.use('/report_match', require('../report_match'));
  app.use('/revert_match', require('../revert_match'));
  app.use('/adjust_negative_mmrs', require('../adjust_negative_mmrs'));
  app.use('/revoke_discord', require('../revoke_discord'));
  app.use('/geolocation', require('../geolocation'));
  app.use('/admin', admin, require('../admin/overview'));
  app.use('/admin/users', admin, require('../admin/users'));
  app.use('/admin/creators', admin, require('../admin/creators'));
  app.use('/admin/settings', admin, require('../admin/settings'));
  app.use((req, res) => res.status(404).render('404', { page: 'Not Found', user: req.user }));
};