const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
let servers = [];

function fetchServers() {
  axios.get(process.env.SERVER_LIST_JSON)
    .then(response => {
      servers = response.data;
    })
    .catch(error => {
      console.error(error.message);
    });
}
fetchServers();
setInterval(fetchServers, 60000); // 1 min

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
  const sv = data.find(v => v.ip === req.params.address);
  if (!sv) {
    return res.redirect('/servers');
  }
  res.render('server', {
    page: sv.name,
    user: req.user,
    sv: sv
  });
});

module.exports = router;
