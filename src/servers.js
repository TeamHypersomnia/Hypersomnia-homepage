const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
let servers = [];

function fetchServers() {
  axios.get('http://hypersomnia.xyz:8420/server_list_json')
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
  const data = servers.map(v => {
    return {
      ...v,
      time_hosted_ago: moment(v.time_hosted * 1000).fromNow(),
      time_last_heartbeat_ago: moment(v.time_last_heartbeat * 1000).fromNow()
    };
  });
  res.render('servers', {
    page: 'Servers',
    user: req.user,
    servers: data
  });
});

module.exports = router;
