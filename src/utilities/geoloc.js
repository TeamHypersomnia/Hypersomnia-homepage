const axios = require('axios');
const LRU = require('lru-cache');
const config = require('../config');

const geoCache = new LRU({
  max: 1000,
  ttl: 24 * 60 * 60 * 1000,
  updateAgeOnGet: false,
  updateAgeOnHas: false
});

async function getGeoData(ip) {
  const cached = geoCache.get(ip);
  if (cached !== undefined) return cached;
  
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    const defaultData = { country: null, loc: null };
    geoCache.set(ip, defaultData);
    return defaultData;
  }
  
  try {
    const { data } = await axios.get(
      `https://ipinfo.io/${ip}/json?token=${config.IPINFO_TOKEN}`,
      {
        headers: { 'Accept': 'application/json' },
        timeout: 3000
      }
    );
    
    const geoData = {
      country: data.country || null,
      loc: data.loc || null,
      city: data.city || null,
      region: data.region || null
    };
    
    geoCache.set(ip, geoData);
    return geoData;
  } catch (err) {
    const defaultData = { country: null, loc: null };
    geoCache.set(ip, defaultData);
    return defaultData;
  }
}

async function getCountryCode(ip) {
  const data = await getGeoData(ip);
  return data.country;
}

async function getLocation(ip) {
  const data = await getGeoData(ip);
  return data.loc;
}

function clearCache() {
  geoCache.clear();
}

function getCacheStats() {
  return {
    size: geoCache.size,
    max: geoCache.max,
    ttl: geoCache.ttl
  };
}

module.exports = {
  getGeoData,
  getCountryCode,
  getLocation,
  clearCache,
  getCacheStats
};