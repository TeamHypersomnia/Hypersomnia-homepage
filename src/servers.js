const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
const { countryCodeEmoji } = require('country-code-emoji');
const config = require('../config');

const geoCache = {};
let servers = [];

const FETCH_URL = config.IS_PROD ?
  'http://127.0.0.1:8410/server_list_json' :
  'https://hypersomnia.io:8410/server_list_json';

fetchServers(FETCH_URL);

async function getIp(clientIp, server) {
  if (geoCache[clientIp]) {
    server.flag = countryCodeEmoji(geoCache[clientIp]);
    return;
  }
  try {
    const res = await axios.get(`https://ipinfo.io/${clientIp}?token=${config.IPINFO_TOKEN}`);
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
      
      newList.forEach(item => {
        item.num_online = item.num_playing + item.num_spectating;
        item.max_online = item.slots + item.num_playing - item.num_online_humans;
        
        const existing = servers.find(s => s.ip === item.ip);
        if (existing) {
          Object.assign(existing, item);
        } else {
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
      
      servers = servers.filter(s => newList.some(n => n.ip === s.ip));
    })
    .catch(err => console.error('MasterServer offline:', err.message))
    .finally(() => setTimeout(() => fetchServers(url), 10000));
}

router.get('/', (req, res) => {
  servers.sort((a, b) => (b.num_online - a.num_online) || a.name.localeCompare(b.name));
  
  res.render('servers', {
    page: 'Servers',
    user: req.user,
    ranked_servers: servers.filter(s => s.is_ranked),
    casual_servers: servers.filter(s => !s.is_ranked)
  });
});

router.get('/:address', (req, res) => {
  const sv = servers.find(v => v.site_displayed_address === req.params.address);
  
  if (!sv) return res.redirect('/servers');
  
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