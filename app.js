require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('./src/config');
const setupMiddleware = require('./src/middleware');
const setupRoutes = require('./src/routes');

const app = express();

app.set('trust proxy', true);
app.set('views', './views');
app.set('view engine', 'ejs');
app.disable('x-powered-by');

if (!config.IS_PROD) {
  app.use(express.static('./public'));
}

// Precompute asset URLs at startup
const assets = ['assets/styles/main.css', 'assets/scripts/main.js'];
const assetMap = {};
assets.forEach(filePath => {
  const fullPath = path.join(__dirname, 'public', filePath);
  const ext = path.extname(filePath);
  const minFilePath = filePath.replace(ext, `.min${ext}`);
  let finalFile = filePath;
  try {
    if (fs.existsSync(path.join(__dirname, 'public', minFilePath))) {
      finalFile = minFilePath;
    }
    const mtime = fs.statSync(path.join(__dirname, 'public', finalFile)).mtimeMs;
    assetMap[filePath] = `/${finalFile}?v=${mtime}`;
  } catch (err) {
    assetMap[filePath] = `/${filePath}`;
  }
});

app.locals.asset = function(filePath) {
  return assetMap[filePath] || `/${filePath}`;
};

setupMiddleware(app);
setupRoutes(app);

app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Server running on ${config.BASE_URL} (${config.IS_PROD ? 'prod' : 'dev'})`);
});