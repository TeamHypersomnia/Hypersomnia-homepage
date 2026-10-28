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

// A tournament's stage: the rounds left to its final - the same words as in the game (tournament_stage.h)
function stageLabel(stage) {
  if (stage === 0) return 'FINALS';
  if (stage === 1) return 'SEMIFINALS';
  if (stage === 2) return 'QUARTERFINALS';
  return `ROUND OF ${2 ** Math.min(stage + 1, 16)}`;
}

function isTournamentMatch(s) {
  return Number.isInteger(s.tournament_stage) && s.tournament_stage >= 0 && Number(s.instance_first_port) > 0;
}

/*
  A tournament's matches under one row: the same key, the same IP, the same first port. The rest - a row each,
  in the list's order (the tournament where its first match was).
*/
function groupTournaments(list) {
  const rows = [];
  const byId = new Map();

  for (const s of list) {
    if (!isTournamentMatch(s)) {
      rows.push({ server: s });
      continue;
    }

    s.stage_label = s.finished ? 'FINISHED' : stageLabel(s.tournament_stage);

    const host = String(s.ip || '').replace(/:\d+$/, '');
    const id = `${s.server_public_key || ''}@${host}:${s.instance_first_port}`;

    if (!byId.has(id)) {
      const row = { tournament: { id: `t${byId.size}`, host, entries: [] } };
      byId.set(id, row.tournament);
      rows.push(row);
    }

    byId.get(id).entries.push(s);
  }

  for (const t of byId.values()) {
    const first = t.entries.find(e => Number(String(e.ip).split(':').pop()) === Number(e.instance_first_port)) || t.entries[0];

    t.name = first.tournament_name || `Tournament ${t.host}`;
    t.tournament_page = /^https?:\/\//.test(first.tournament_page || '') ? first.tournament_page : '';
    t.is_official = first.is_official;
    t.flag = first.flag;
    t.finished = t.entries.length === 1 && t.entries[0].finished && t.entries[0].tournament_stage === 0;
    t.humans = t.entries.reduce((n, e) => n + (Number(e.num_online_humans) || 0), 0);
    t.max_online = t.entries.reduce((n, e) => n + (Number(e.max_online) || 0), 0);
    t.entries.sort((a, b) => Number(String(a.ip).split(':').pop()) - Number(String(b.ip).split(':').pop()));
  }

  return rows;
}

router.get('/', async (req, res) => {
  try {
    const servers = await fetchAndProcessServers();
    
    // ranked first, then by real (non-bot) players
    const sorted = [...servers].sort((a, b) => {
      if (a.is_ranked !== b.is_ranked) return a.is_ranked ? -1 : 1;
      const aHumans = Number(a.num_online_humans) || 0;
      const bHumans = Number(b.num_online_humans) || 0;
      return bHumans - aHumans;
    });
    
    const officialServers = sorted.filter(s => s.is_official);
    const communityServers = sorted.filter(s => !s.is_official);
    
    res.render('servers', {
      page: 'Servers',
      user: req.user,
      official_servers: groupTournaments(officialServers),
      community_servers: groupTournaments(communityServers)
    });
  } catch (err) {
    console.error('Error fetching servers:', err.message);
    res.status(500).render('error', {
      noindex: true,
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
      return res.redirect('/servers');
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
    res.redirect('/servers');
  }
});

module.exports = router;