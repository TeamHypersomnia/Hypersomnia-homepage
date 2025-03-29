const express = require('express')
const router = express.Router()
const axios = require('axios')
const moment = require('moment')

let ranked_servers = []
let casual_servers = []

function fetchServers(app) {
  axios.get(process.env.SERVER_LIST_JSON)
    .then(response => {
      const servers = response.data.map(server => ({
        ...server,
        num_online: server.num_playing + server.num_spectating
      }))

      ranked_servers = servers.filter(server => server.is_ranked)
      casual_servers = servers.filter(server => !server.is_ranked)

      let totalServers = servers.length
      let totalPlayers = servers.reduce((acc, sv) => acc + sv.num_online, 0)

      app.locals.players_ingame = totalPlayers
      app.locals.online_servers = totalServers
    })
    .catch(error => {
      console.error(error.message)
    })
}

router.get('/', function (req, res) {
  ranked_servers.sort((a, b) => b.num_online - a.num_online || a.name.localeCompare(b.name))
  casual_servers.sort((a, b) => b.num_online - a.num_online || a.name.localeCompare(b.name))

  res.render('servers', {
    page: 'Servers',
    user: req.user,
    ranked_servers,
    casual_servers
  })
})

router.get('/:address', function (req, res) {
  const all_servers = [...ranked_servers, ...casual_servers].map(v => ({
    ...v,
    time_hosted_ago: moment(v.time_hosted * 1000).fromNow(),
    time_last_heartbeat_ago: moment(v.time_last_heartbeat * 1000).fromNow()
  }))

  const sv = all_servers.find(v => v.site_displayed_address === req.params.address)
  if (!sv) {
    return res.redirect('/servers')
  }

  res.render('server', {
    page: sv.name,
    user: req.user,
    sv
  })
})

module.exports = { router, fetchServers }
