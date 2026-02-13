const express = require('express');
const router = express.Router();
const axios = require('axios');
const { timeAgoShort } = require('./utilities/timeAgo');
const { countryCodeToEmoji } = require('./utils');
const { getCountryCode } = require('./utilities/geoloc');
const config = require('./config');

async function fetchAndProcessServers() {
  const { data: serverList } = await axios.get(config.SERVER_LIST_URL, {
    timeout: 5000
  });
  
  if (!Array.isArray(serverList)) {
    throw new Error('Invalid server list format');
  }
  
  const processed = await Promise.all(serverList.map(async (server) => {
    const copy = { ...server };
    
    const numPlaying = Number(server.num_playing) || 0;
    const numSpectating = Number(server.num_spectating) || 0;
    const slots = Number(server.slots) || 0;
    const numOnlineHumans = Number(server.num_online_humans) || 0;
    
    copy.num_online = numPlaying + numSpectating;
    copy.max_online = slots + numPlaying - numOnlineHumans;
    
    if (copy.max_online < copy.num_online) {
      copy.max_online = copy.num_online;
    }
    
    const match = server.name?.match(/\[([A-Z]{2})\]/);
    if (match) {
      copy.flag = countryCodeToEmoji(match[1]);
    } else if (server.ip) {
      const ip = server.ip.split(':')[0];
      const countryCode = await getCountryCode(ip);
      copy.flag = countryCode ? countryCodeToEmoji(countryCode) : '🏴';
    } else {
      copy.flag = '🏴';
    }
    
    return copy;
  }));
  
  return processed;
}

router.get('/', async (req, res) => {
  try {
    const servers = await fetchAndProcessServers();
    
    const sorted = [...servers].sort((a, b) => {
      const aHumans = Number(a.num_online_humans) || 0;
      const bHumans = Number(b.num_online_humans) || 0;
      return bHumans - aHumans;
    });
    
    const rankedServers = sorted.filter(s => s.is_ranked);
    const casualServers = sorted.filter(s => !s.is_ranked);
    
    res.render('servers', {
      page: 'Servers',
      user: req.user,
      ranked_servers: rankedServers,
      casual_servers: casualServers
    });
  } catch (err) {
    console.error('Error fetching servers:', err.message);
    res.status(500).render('error', {
      page: 'Servers',
      user: req.user,
      message: 'Failed to load servers'
    });
  }
});

router.get('/:address', async (req, res) => {
  try {
    const servers = await fetchAndProcessServers();
    const server = servers.find(s => s.site_displayed_address === req.params.address);
    
    if (!server) {
      return res.status(404).redirect('/servers');
    }
    
    res.render('server', {
      page: server.name || 'Server',
      user: req.user,
      sv: {
        ...server,
        time_hosted_ago: server.time_hosted ? timeAgoShort(server.time_hosted) : 'Unknown',
        time_last_heartbeat_ago: server.time_last_heartbeat ? timeAgoShort(server.time_last_heartbeat) : 'Unknown'
      }
    });
  } catch (err) {
    console.error('Error fetching server:', err.message);
    res.status(500).redirect('/servers');
  }
});

module.exports = router;