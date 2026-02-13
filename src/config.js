const crypto = require('crypto');

// Environment detection
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const IS_DEV = NODE_ENV === 'development';

// Server port validation
const PORT = parseInt(process.env.PORT, 10) || 3000;
if (PORT < 1 || PORT > 65535) {
  throw new Error(`Invalid PORT: ${PORT}. Must be between 1 and 65535`);
}

// Admin user IDs from comma-separated env var
const ADMIN_IDS = process.env.ADMINS ?
  process.env.ADMINS.split(',').map(id => id.trim()).filter(Boolean) :
  [];

// Base URL with trailing slash
const BASE_URL = (() => {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.endsWith('/') ?
      process.env.BASE_URL :
      `${process.env.BASE_URL}/`;
  }
  return IS_PROD ? 'https://hypersomnia.io/' : `http://localhost:${PORT}/`;
})();

// Require env var in production, allow empty in dev
function requireEnvVar(name, value) {
  if (IS_PROD && !value) {
    throw new Error(`${name} is required in production`);
  }
  return value || '';
}

// Generate random session secret in dev, require in prod
function getSessionSecret() {
  const envSecret = process.env.SESSION_SECRET;
  
  if (envSecret) {
    return envSecret;
  }
  
  if (IS_PROD) {
    throw new Error('SESSION_SECRET is required in production');
  }
  
  return crypto.randomBytes(32).toString('hex');
}

// Validate Steam API key format (32 hex characters)
const STEAM_API_KEY = (() => {
  const key = requireEnvVar('STEAM_APIKEY', process.env.STEAM_APIKEY);
  if (key && !/^[A-F0-9]{32}$/i.test(key)) {
    if (IS_DEV) console.warn('STEAM_APIKEY format may be invalid');
  }
  return key;
})();

const config = {
  NODE_ENV,
  IS_PROD,
  IS_DEV,
  
  PORT,
  BASE_URL,
  
  ADMIN_IDS,
  SESSION_SECRET: getSessionSecret(),
  
  STEAM_API_KEY,
  IPINFO_TOKEN: requireEnvVar('IPINFO_API_TOKEN', process.env.IPINFO_API_TOKEN),
  DISCORD_CLIENT_ID: requireEnvVar('DISCORD_CLIENT_ID', process.env.DISCORD_CLIENT_ID),
  DISCORD_CLIENT_SECRET: requireEnvVar('DISCORD_CLIENT_SECRET', process.env.DISCORD_CLIENT_SECRET),
  DISCORD_BOT_TOKEN: requireEnvVar('DISCORD_BOT_TOKEN', process.env.DISCORD_BOT_TOKEN),
  
  COOKIE_SECURE: IS_PROD,
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000,
  
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024,
  ALLOWED_UPLOAD_EXTENSIONS: ['json', 'png', 'jpg', 'gif', 'ogg', 'wav'],
  
  // Master server config: prod uses localhost, dev uses remote
  SERVER_LIST_URL: process.env.SERVER_LIST_URL || (IS_PROD ? 'http://127.0.0.1:8410/server_list_json' : 'https://masterserver.hypersomnia.io:8420/server_list_json'),
  SERVER_LIST_REFRESH_INTERVAL: 10000,
  
  DB_PATH: process.env.DB_PATH || './private/mmr.db',
  LOG_LEVEL: process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug')
};

// Validate required env vars in production
if (IS_PROD) {
  const required = ['STEAM_API_KEY', 'SESSION_SECRET', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_BOT_TOKEN', 'IPINFO_TOKEN'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required variables: ${missing.join(', ')}`);
  }
}

// Prevent modifications to config object
Object.freeze(config);

module.exports = config;