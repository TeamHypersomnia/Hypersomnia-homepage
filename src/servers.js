const axios = require('axios');
const moment = require('moment');
let servers = [];

module.exports = {
  init: function () {
    function fetchServers() {
      axios.get('http://hypersomnia.xyz:8420/server_list_json')
        .then(response => {
          servers = response.data;
        })
        .catch(error => {
          console.error(`Error fetching servers: ${error.message}`);
        });
    }
    fetchServers();
    setInterval(fetchServers, 60000); // 1 minute
  },

  getServers: function () {
    const formattedData = servers.map(v => {
      return {
        ...v,
        time_hosted_ago: moment(v.time_hosted * 1000).fromNow(),
        time_last_heartbeat_ago: moment(v.time_last_heartbeat * 1000).fromNow(),
      };
    });
    return formattedData;
  }
};
