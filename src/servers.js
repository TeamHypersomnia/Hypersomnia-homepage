const express = require('express');
const router = express.Router();
const axios = require('axios');
const { timeAgo } = require('utilities/timeAgo.js');
const { countryCodeToEmoji } = require('./utils');
const config = require('./config');

const geoCache = new Map();
let servers = [];

const FETCH_URL = 'https://hypersomnia.io/server_list_json';

// Fetch and process servers
const fetchServers = async () => {
  try {
    const { data: serverList } = await axios.get(FETCH_URL, { timeout: 5000 });

    const processed = await Promise.all(serverList.map(async (server) => {
      const copy = { ...server };
      copy.num_online = (server.num_playing || 0) + (server.num_spectating || 0);
      copy.max_online = (server.slots || 0) + (server.num_playing || 0) - (server.num_online_humans || 0);

      // Try to get emoji from name or IP
      const match = server.name.match(/\[([A-Z]{2})\]/);
      if (match) {
        copy.flag = countryCodeToEmoji(match[1]);
      } else {
        const ip = server.ip.split(':')[0];
        copy.flag = await getFlag(ip);
      }

      return copy;
    }));

    servers = processed;
  } catch (err) {
    console.error('MasterServer sync error:', err.message);
  } finally {
    setTimeout(fetchServers, 10000); // Refresh every 10 seconds
  }
};

// Get flag from IP with caching
async function getFlag(ip) {
  if (geoCache.has(ip)) return geoCache.get(ip);

  try {
    const { data } = await axios.get(`https://ipinfo.io/${ip}?token=${config.IPINFO_TOKEN}`, { timeout: 5000 });
    const emoji = data.country ? countryCodeToEmoji(data.country) : '🏴';
    geoCache.set(ip, emoji);
    return emoji;
  } catch {
    return '🏴';
  }
}

fetchServers();

// Route: list all servers, sorted by players online
router.get('/', (req, res) => {
  const sorted = [...servers].sort((a, b) => b.num_online - a.num_online);

  res.render('servers', {
    page: 'Servers',
    user: req.user,
    ranked_servers: sorted.filter(s => s.is_ranked),
    casual_servers: sorted.filter(s => !s.is_ranked)
  });
});

// Route: single server page
router.get('/:address', (req, res) => {
  const server = servers.find(s => s.site_displayed_address === req.params.address);
  if (!server) return res.redirect('/servers');

  res.render('server', {
    page: server.name,
    user: req.user,
    sv: {
      ...server,
      time_hosted_ago: timeAgo(server.time_hosted),
      time_last_heartbeat_ago: timeAgo(server.time_last_heartbeat)
    }
  });
});

module.exports = router;
