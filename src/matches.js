const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
const { countryCodeToEmoji } = require('./utils');
const config = require('./config');

const geoCache = new Map();
let servers = [];

const FETCH_URL = 'https://hypersomnia.io/server_list_json';

const fetchServers = async () => {
  try {
    const { data: newList } = await axios.get(FETCH_URL, {
      timeout: 5000
    });
    
    const processed = await Promise.all(newList.map(async (item) => {
      const server = { ...item };
      server.num_online = (server.num_playing || 0) + (server.num_spectating || 0);
      server.max_online = (server.slots || 0) + (server.num_playing || 0) - (server.num_online_humans || 0);
      
      const match = server.name.match(/\[([A-Z]{2})\]/);
      if (match) {
        server.flag = countryCodeToEmoji(match[1]);
      } else {
        const ip = server.ip.split(':')[0];
        server.flag = await getFlag(ip);
      }
      return server;
    }));
    
    servers = processed;
  } catch (err) {
    console.error('MasterServer sync error:', err.message);
  } finally {
    setTimeout(fetchServers, 10000);
  }
};

async function getFlag(ip) {
  if (geoCache.has(ip)) return geoCache.get(ip);
  
  try {
    const { data } = await axios.get(`https://ipinfo.io/${ip}?token=${config.IPINFO_TOKEN}`);
    const emoji = data.country ? countryCodeToEmoji(data.country) : '🏴';
    geoCache.set(ip, emoji);
    return emoji;
  } catch {
    return '🏴';
  }
}

fetchServers();

router.get('/', (req, res) => {
  const sorted = [...servers].sort((a, b) => (b.num_online - a.num_online) || a.name.localeCompare(b.name));
  
  res.render('servers', {
    page: 'Servers',
    user: req.user,
    ranked_servers: sorted.filter(s => s.is_ranked),
    casual_servers: sorted.filter(s => !s.is_ranked)
  });
});

router.get('/:address', (req, res) => {
  const sv = servers.find(v => v.site_displayed_address === req.params.address);
  if (!sv) return res.redirect('/servers');
  
  res.render('server', {
    page: sv.name,
    user: req.user,
    sv: {
      ...sv,
      time_hosted_ago: moment(sv.time_hosted * 1000).fromNow(),
      time_last_heartbeat_ago: moment(sv.time_last_heartbeat * 1000).fromNow()
    }
  });
});

module.exports = router;