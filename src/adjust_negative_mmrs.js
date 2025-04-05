const assert = require('assert');

const fs = require('fs');
const express = require('express');
const Database = require('better-sqlite3');

const router = express.Router();

const authorizedServersPath = `${__dirname}/../private/authorized_ranked_servers.json`;
const authorizedServersData = fs.readFileSync(authorizedServersPath, {
  encoding: 'utf8',
  flag: 'r'
});

const authorizedServers = JSON.parse(authorizedServersData);

// Middleware for API key authentication
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['apikey'];

  if (apiKey in authorizedServers) {
    // Set server ID in the request for later use
    req.server_id = authorizedServers[apiKey].id;

    if (req.server_id === 'pl') {
      next();
    }
    else {
      res.status(401).send({ error: 'Unauthorized' });
    }
  } else {
    res.status(401).send({ error: 'Unauthorized' });
  }
}

router.post('/', apiKeyAuth, (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { multiplier } = req.body;

  if (!multiplier) {
    return res.status(400).json({ error: 'Missing multiplier' });
  }

  if (typeof multiplier !== 'number') {
    return res.status(400).json({ error: 'Wrong multiplier type' });
  }

  if (multiplier < 0.0) {
    return res.status(400).json({ error: 'Wrong multiplier' });
  }

  let db;

  try {
    db = new Database(process.env.DB_PATH);

    const updateMu = db.transaction(() => {
      const updateTeamMu = db.prepare(`
          UPDATE mmr_team
          SET mu = (mmr * ?) + 3 * sigma
          WHERE mmr < 0
        `);
      updateTeamMu.run(multiplier);

      const updateFFAMu = db.prepare(`
          UPDATE mmr_ffa
          SET mu = (mmr * ?) + 3 * sigma
          WHERE mmr < 0
        `);
      updateFFAMu.run(multiplier);

      const updateTeamMMR = db.prepare(`
          UPDATE mmr_team
          SET mmr = mu - 3 * sigma
          WHERE mmr < 0
        `);
      updateTeamMMR.run();

      // Prepare SQL to update mmr in mmr_ffa table after adjusting mu
      const updateFFAMMR = db.prepare(`
          UPDATE mmr_ffa
          SET mmr = mu - 3 * sigma
          WHERE mmr < 0
        `);
      updateFFAMMR.run();
    })();

    res.json({ message: 'MMRs adjusted successfully' });
  }
  catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }finally {
    if (db) {
      db.close(); 
    }
  }
});

module.exports = router;
