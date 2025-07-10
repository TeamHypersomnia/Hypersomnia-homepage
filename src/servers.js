const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
const { countryCodeEmoji } = require('country-code-emoji');
const geoCache = {};
let servers = [];

if (process.env.NODE_ENV == 'production') {
  fetchServers('http://127.0.0.1:8410/server_list_json');
} else {
  fetchServers('https://hypersomnia.xyz:8420/server_list_json');
}

function getIp(clientIp, server) {
  if (geoCache[clientIp]) {
    server.flag = countryCodeEmoji(geoCache[clientIp]);
    return;
  }
  axios.get(`https://ipinfo.io/${clientIp}?token=${process.env.IPINFO_API_TOKEN}`)
    .then(response => {
      geoCache[clientIp] = response.data.country;
      server.flag = countryCodeEmoji(response.data.country);
    })
    .catch(error => {
      console.error('GeoIP lookup failed:', error.message);
    });
}

function fetchServers(url) {
  axios.get(url)
    .then(response => {
      const newServerList = response.data;
      newServerList.forEach(newServer => {
        const existing = servers.find(s => s.ip === newServer.ip);
        newServer.num_online = newServer.num_playing + newServer.num_spectating;
        newServer.max_online = newServer.slots + newServer.num_playing - newServer.num_online_humans;
        if (existing) {
          // Update all properties but keep the flag
          Object.assign(existing, newServer);
        } else {
          // New server, set flag or fallback
          const regex = /\[([A-Z]{2})\]/;
          const match = newServer.name.match(regex);
          if (match) {
            newServer.flag = countryCodeEmoji(match[1]);
          } else {
            newServer.flag = '🏴';
            getIp(newServer.ip.split(':')[0], newServer);
          }
          servers.push(newServer);
        }
      });
      // Remove servers that no longer exist
      servers = servers.filter(s => newServerList.some(n => n.ip === s.ip));
    })
    .catch(error => {
      console.error('Error fetching server list:', error.message);
    })
    .finally(() => {
      setTimeout(() => {
        fetchServers(url);
      }, 10000);
    });
}

router.get('/', function (req, res) {
  servers.sort((a, b) => {
    if (b.num_online !== a.num_online) {
      return b.num_online - a.num_online;
    }
    return a.name.localeCompare(b.name);
  });

  const ranked_servers = servers.filter(s => s.is_ranked);
  const casual_servers = servers.filter(s => !s.is_ranked);

  res.render('servers', {
    page: 'Servers',
    user: req.user,
    ranked_servers,
    casual_servers
  });
});

router.get('/:address', function (req, res) {
  const all_servers = [...servers].map(v => ({
    ...v,
    time_hosted_ago: moment(v.time_hosted * 1000).fromNow(),
    time_last_heartbeat_ago: moment(v.time_last_heartbeat * 1000).fromNow()
  }));

  const sv = all_servers.find(v => v.site_displayed_address === req.params.address);
  if (!sv) {
    return res.redirect('/servers');
  }

  res.render('server', {
    page: sv.name,
    user: req.user,
    sv
  });
});

module.exports = router;
