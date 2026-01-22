const express = require('express');
const router = express.Router();
const axios = require('axios');
const { timeAgoShort } = require('./utilities/timeAgo');
const { countryCodeToEmoji } = require('./utils');
const { getCountryCode } = require('./utilities/geoloc');
const config = require('./config');

let servers = [];
let lastFetchError = null;
let fetchInProgress = false;

// Fetch and process servers
const fetchServers = async () => {
  if (fetchInProgress) return;
  
  fetchInProgress = true;
  
  try {
    const { data: serverList } = await axios.get(config.SERVER_LIST_URL, {
      timeout: 5000
    });
    
    if (!Array.isArray(serverList)) {
      throw new Error('Invalid server list format');
    }
    
    const processed = await Promise.all(serverList.map(async (server) => {
      const copy = { ...server };
      
      // Calculate online counts safely
      const numPlaying = Number(server.num_playing) || 0;
      const numSpectating = Number(server.num_spectating) || 0;
      const slots = Number(server.slots) || 0;
      const numOnlineHumans = Number(server.num_online_humans) || 0;
      
      copy.num_online = numPlaying + numSpectating;
      copy.max_online = slots + numPlaying - numOnlineHumans;
      
      // Ensure max_online is at least num_online
      if (copy.max_online < copy.num_online) {
        copy.max_online = copy.num_online;
      }
      
      // Try to get emoji from name first (faster)
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
    
    servers = processed;
    lastFetchError = null;
    
    if (config.IS_DEV) {
      console.log(`[${new Date().toISOString()}] Fetched ${servers.length} servers from ${config.SERVER_LIST_URL}`);
    }
  } catch (err) {
    lastFetchError = err.message;
    console.error(`[${new Date().toISOString()}] MasterServer sync error:`, err.message);
    
    // Keep existing servers on error instead of clearing
    if (servers.length === 0) {
      console.error('No cached servers available');
    }
  } finally {
    fetchInProgress = false;
    setTimeout(fetchServers, config.SERVER_LIST_REFRESH_INTERVAL);
  }
};

// Initialize server fetching
fetchServers();

// Route: list all servers, sorted by human players
router.get('/', (req, res) => {
  try {
    // Create a sorted copy by human players (descending)
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
    console.error('Error rendering servers page:', err);
    res.status(500).render('error', {
      page: 'Error',
      user: req.user,
      message: 'Failed to load servers'
    });
  }
});

// Route: single server page
router.get('/:address', (req, res) => {
  try {
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
    console.error('Error rendering server page:', err);
    res.status(500).redirect('/servers');
  }
});

module.exports = router;