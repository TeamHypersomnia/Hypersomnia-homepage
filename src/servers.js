const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
let servers = [];

function fetchServers(app) {
  axios.get(process.env.SERVER_LIST_JSON)
    .then(response => {
      servers = response.data;
      let totalServers = 0;
      let totalPlayers = 0;
      servers.forEach(sv => {
        totalServers++;
        totalPlayers += sv.num_playing + sv.num_spectating;
      });
      app.locals.players_ingame = totalPlayers;
      app.locals.online_servers = totalServers;
    })
    .catch(error => {
      console.error(error.message);
    });
}

router.get('/', function (req, res) {
  servers.sort((a, b) => {
    if (a.num_playing !== b.num_playing) {
      return b.num_playing - a.num_playing;
    } else {
      return a.name.localeCompare(b.name);
    }
  });
  res.render('servers', {
    page: 'Servers',
    user: req.user,
    servers: servers
  });
});

router.get('/:address', function (req, res) {
  const data = servers.map(v => {
    return {
      ...v,
      time_hosted_ago: moment(v.time_hosted * 1000).fromNow(),
      time_last_heartbeat_ago: moment(v.time_last_heartbeat * 1000).fromNow()
    };
  });
  const sv = data.find(v => v.site_displayed_address === req.params.address);
  if (!sv) {
    return res.redirect('/servers');
  }
  res.render('server', {
    page: sv.name,
    user: req.user,
    sv: sv
  });
});

module.exports = { router, fetchServers };
