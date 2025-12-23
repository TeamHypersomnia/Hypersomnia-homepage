const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_IDS = process.env.ADMINS ? process.env.ADMINS.split(',') : [];
const BASE_URL = IS_PROD ? 'https://hypersomnia.io/' : `http://localhost:${PORT}/`;

module.exports = {
  PORT,
  IS_PROD,
  ADMIN_IDS,
  BASE_URL,
  STEAM_API_KEY: process.env.STEAM_APIKEY || '',
  SESSION_SECRET: process.env.SESSION_SECRET || '',
  IPINFO_TOKEN: process.env.IPINFO_API_TOKEN || '',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || ''
};