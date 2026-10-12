const passport = require('../passport');
const { authenticated, admin } = require('../middleware/auth');

const buildSizes = require('../build_sizes');

const SITE = 'https://hypersomnia.io';

module.exports = (app) => {
  // lets any view link an arena name only when that arena exists
  app.locals.hasArena = require('../arenas').hasArena;

  // how an account is shown, e.g. a key as "0xaf2e22db…" - see utils.js
  app.locals.accountLabel = require('../utils').accountLabel;
  app.locals.fullAccountId = require('../utils').fullAccountId;

  // canonical URL of the current page: production domain, no query, no trailing slash
  app.use((req, res, next) => {
    const path = req.path.length > 1 ? req.path.replace(/\/+$/, '') : '/';
    res.locals.canonicalUrl = SITE + path;
    next();
  });

  app.get('/sitemap.xml', require('../sitemap'));
  app.get('/', (req, res) => res.render('index', {
    page: false,
    user: req.user,
    buildSizes: buildSizes.get()
  }));
  app.get('/privacy', (req, res) => res.render('privacy', { page: 'Privacy', user: req.user }));
  // old pages, merged into /privacy
  app.get(['/disclaimer', '/cookie-policy'], (req, res) => res.redirect(301, '/privacy'));
  app.use('/weapons', require('../weapons'));
  app.use('/leaderboards', require('../leaderboards'));
  app.use('/matches', require('../matches'));
  app.use('/arenas', require('../arenas'));
  app.use('/servers', require('../servers'));
  app.use('/tournament', require('../tournament'));
  app.use('/user', require('../user'));
  app.use('/auth', require('../auth')(passport));
  app.use('/profile', authenticated, require('../profile'));
  // the code to link a game key, alone on its page - signs in through Steam first and comes back here
  app.get('/link', (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.session.after_login = '/link';
      return res.redirect('/auth/steam');
    }

    next();
  }, require('../profile').linkPage);
  app.use('/link_key', require('../link_key').router);
  app.use('/cert', require('../broker').router);
  app.use('/avatar', require('../avatars').router);
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
  app.use('/admin/avatars', admin, require('../admin/avatars'));
  app.use((req, res) => res.status(404).render('404', { page: 'Not Found', user: req.user, noindex: true }));
};