const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
let servers = [];

function fetchServers(app) {
  axios.get(process.env.SERVER_LIST_JSON)
    .then(response => {
      servers = response.data.map(server => ({
        ...server,
        num_online: server.num_playing + server.num_spectating
      }));
      
      let totalServers = servers.length;
      let totalPlayers = servers.reduce((acc, sv) => acc + sv.num_online, 0);
      
      app.locals.players_ingame = totalPlayers;
      app.locals.online_servers = totalServers;
    })
    .catch(error => {
      console.error(error.message);
    });
}

router.get('/', function (req, res) {
  servers.sort((a, b) => {
    if (a.num_online !== b.num_online) {
      return b.num_online - a.num_online;
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
