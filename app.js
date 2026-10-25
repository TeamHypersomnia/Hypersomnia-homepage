require('dotenv').config();
const express = require('express');
const config = require('./src/config');
const setupMiddleware = require('./src/middleware');
const setupRoutes = require('./src/routes');
const app = express();

app.set('trust proxy', 'loopback');
app.set('views', './views');
app.set('view engine', 'ejs');
app.disable('x-powered-by');

if (!config.IS_PROD) {
  app.use(express.static('./public'));
  // in production nginx serves arena files (miniatures etc.) directly
  app.use('/arenas', express.static('./hosting/arenas', { index: false, redirect: false }));
  // in production nginx serves the builds' folder - site data included
  app.use('/builds/site_data', express.static(config.SITE_DATA_PATH, { index: false, redirect: false }));
}

setupMiddleware(app);
setupRoutes(app);

app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Server running on ${config.BASE_URL} (${config.IS_PROD ? 'prod' : 'dev'})`);
});