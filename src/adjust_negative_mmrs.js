const express = require('express');
const db = require('./db');
const router = express.Router();

// Pre-compile statements for maximum performance
const stmts = {
  updateTeamMu: db.prepare('UPDATE mmr_team SET mu = (mmr * ?) + 3 * sigma WHERE mmr < 0'),
  updateFFAMu: db.prepare('UPDATE mmr_ffa SET mu = (mmr * ?) + 3 * sigma WHERE mmr < 0'),
  updateTeamMMR: db.prepare('UPDATE mmr_team SET mmr = mu - 3 * sigma WHERE mmr < 0'),
  updateFFAMMR: db.prepare('UPDATE mmr_ffa SET mmr = mu - 3 * sigma WHERE mmr < 0')
};

// Pre-compile statement to fetch server by API key
const getServerByKey = db.prepare('SELECT server_id FROM authorized_servers WHERE api_key = ?');

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['apikey'];
  if (!apiKey) return res.status(401).json({ error: 'Unauthorized' });

  const row = getServerByKey.get(apiKey);
  if (!row) return res.status(401).json({ error: 'Unauthorized' });

  // Restrict access specifically to the 'pl' server
  if (row.server_id !== 'pl') return res.status(401).json({ error: 'Unauthorized' });

  req.server_id = row.server_id;
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
