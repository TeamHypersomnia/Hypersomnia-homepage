require('dotenv').config();
const express = require('express');
const config = require('./src/config');
const setupMiddleware = require('./src/middleware');
const setupRoutes = require('./src/routes');

const app = express();

app.set('trust proxy', true);
app.set('views', './views');
app.disable('x-powered-by');

if (!config.IS_PROD) {
  app.use(express.static('./public'));
}

setupMiddleware(app);
setupRoutes(app);

app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Server running on ${config.BASE_URL}`);
  console.log(`Environment: ${config.IS_PROD ? 'production' : 'development'}`);
});