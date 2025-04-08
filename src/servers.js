const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
const { countryCodeEmoji } = require('country-code-emoji');

let servers = [];
const geoCache = {};

function getIp(clientIp, server) {
  if (geoCache[clientIp]) {
    server.emoji = countryCodeEmoji(geoCache[clientIp]);
    return;
  }
  axios.get(`https://ipinfo.io/${clientIp}?token=${process.env.IPINFO_API_TOKEN}`)
    .then(response => {
      geoCache[clientIp] = response.data.country;
      server.emoji = countryCodeEmoji(response.data.country);
    })
    .catch(error => {
      console.error('GeoIP lookup failed:', error.message);
    });
}

function fetchServers() {
  axios.get(process.env.SERVER_LIST_JSON)
    .then(response => {
      servers = response.data.map(server => {
        const regex = /\[([A-Z]{2})\]/;
        const match = server.name.match(regex);
        if (match) {
          server.emoji = countryCodeEmoji(match[1]);
        } else {
          server.emoji = '🏴';
          getIp(server.ip.split(':')[0], server);
        }
        server.num_online = server.num_playing + server.num_spectating;
        return server;
      });
    })
    .catch(error => {
      console.error('Error fetching server list:', error.message);
    });
}

setInterval(fetchServers, 10000);
fetchServers();


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
