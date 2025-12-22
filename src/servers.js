const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
const { countryCodeEmoji } = require('country-code-emoji');

const geoCache = {};
let servers = [];

const DOMAIN = process.env.MASTERSERVER_DOMAIN;
const FETCH_URL = process.env.NODE_ENV === 'production' ?
  'http://127.0.0.1:8410/server_list_json' :
  `${DOMAIN}:8420/server_list_json`;

// Initial call
fetchServers(FETCH_URL);

async function getIp(clientIp, server) {
  if (geoCache[clientIp]) {
    server.flag = countryCodeEmoji(geoCache[clientIp]);
    return;
  }
  try {
    const res = await axios.get(`https://ipinfo.io/${clientIp}?token=${process.env.IPINFO_API_TOKEN}`);
    geoCache[clientIp] = res.data.country;
    server.flag = countryCodeEmoji(res.data.country);
  } catch (error) {
    console.error('GeoIP failed:', error.message);
  }
}

function fetchServers(url) {
  axios.get(url)
    .then(response => {
      const newList = response.data;
      
      // Update or add servers
      newList.forEach(item => {
        item.num_online = item.num_playing + item.num_spectating;
        item.max_online = item.slots + item.num_playing - item.num_online_humans;
        
        const existing = servers.find(s => s.ip === item.ip);
        if (existing) {
          Object.assign(existing, item); // Sync stats, keep flag
        } else {
          // Parse flag from name [US] or use GeoIP
          const match = item.name.match(/\[([A-Z]{2})\]/);
          if (match) {
            item.flag = countryCodeEmoji(match[1]);
          } else {
            item.flag = '🏴';
            getIp(item.ip.split(':')[0], item);
          }
          servers.push(item);
        }
      });
      
      // Remove dead servers
      servers = servers.filter(s => newList.some(n => n.ip === s.ip));
    })
    .catch(err => console.error('MasterServer offline:', err.message))
    .finally(() => setTimeout(() => fetchServers(url), 10000));
}

// Main list view
router.get('/', (req, res) => {
  servers.sort((a, b) => (b.num_online - a.num_online) || a.name.localeCompare(b.name));
  
  res.render('servers', {
    page: 'Servers',
    user: req.user,
    ranked_servers: servers.filter(s => s.is_ranked),
    casual_servers: servers.filter(s => !s.is_ranked)
  });
});

// Single server details view
router.get('/:address', (req, res) => {
  const sv = servers.find(v => v.site_displayed_address === req.params.address);
  
  if (!sv) return res.redirect('/servers');
  
  // Format timestamps for display
  const details = {
    ...sv,
    time_hosted_ago: moment(sv.time_hosted * 1000).fromNow(),
    time_last_heartbeat_ago: moment(sv.time_last_heartbeat * 1000).fromNow()
  };
  
  res.render('server', {
    page: sv.name,
    user: req.user,
    sv: details
  });
});

module.exports = router;