const express = require('express');
const fs = require('fs');
const db = require('./db');
const router = express.Router();

const authorizedServersPath = './private/authorized_ranked_servers.json';
const authorizedServers = JSON.parse(fs.readFileSync(authorizedServersPath, 'utf8'));

// Pre-compile statements for maximum performance
const stmts = {
  updateTeamMu: db.prepare('UPDATE mmr_team SET mu = (mmr * ?) + 3 * sigma WHERE mmr < 0'),
  updateFFAMu: db.prepare('UPDATE mmr_ffa SET mu = (mmr * ?) + 3 * sigma WHERE mmr < 0'),
  updateTeamMMR: db.prepare('UPDATE mmr_team SET mmr = mu - 3 * sigma WHERE mmr < 0'),
  updateFFAMMR: db.prepare('UPDATE mmr_ffa SET mmr = mu - 3 * sigma WHERE mmr < 0')
};

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['apikey'];
  
  // Strict property check to prevent prototype pollution exploits
  if (!apiKey || !Object.prototype.hasOwnProperty.call(authorizedServers, apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const server = authorizedServers[apiKey];
  
  // Restrict access specifically to the 'pl' server
  if (server.id !== 'pl') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.server_id = server.id;
  next();
}

router.post('/', apiKeyAuth, (req, res) => {
  const { multiplier } = req.body;
  
  // Validation: ensures 0 is allowed but rejects negative numbers
  if (multiplier === undefined || typeof multiplier !== 'number' || multiplier < 0) {
    return res.status(400).json({ error: 'Valid numeric multiplier required' });
  }
  
  try {
    // Transaction ensures atomicity (all updates succeed or all fail)
    db.transaction((m) => {
      stmts.updateTeamMu.run(m);
      stmts.updateFFAMu.run(m);
      stmts.updateTeamMMR.run();
      stmts.updateFFAMMR.run();
    })(multiplier);
    
    res.json({ message: 'MMRs adjusted successfully' });
  } catch (error) {
    console.error('MMR Adjustment Error:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;