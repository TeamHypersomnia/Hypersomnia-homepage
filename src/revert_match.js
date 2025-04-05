const assert = require('assert');

const fs = require('fs');
const express = require('express');
const Database = require('better-sqlite3');
const { lose_severity, severityToString } = require('./lose_severity');
const moment = require('moment-timezone');

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
    next();
  } else {
    res.status(401).send({ error: 'Unauthorized' });
  }
}

router.post('/', apiKeyAuth, (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { match_id } = req.body;

  try {
    const db = new Database(process.env.DB_PATH);

    db.transaction(() => {
      // Fetch the match data
      const match = db.prepare('SELECT * FROM matches WHERE match_id = ?').get(match_id);
      if (!match) {
        throw new Error('Match not found');
      }

      const game_mode = match.game_mode;
      const winners = JSON.parse(match.winners);
      const losers = JSON.parse(match.losers);
      const tableName = game_mode === 'FFA Gun Game' ? 'mmr_ffa' : 'mmr_team';
      const isTie = tableName === 'mmr_team' && match.win_score === match.lose_score && match.win_score === 15;

      // Prepare statements for updating player mmr, matches won, and matches lost, and for removing the match
      const stmtUpdatePlayer = db.prepare(`UPDATE ${tableName} SET mmr = mmr - ?, matches_won = matches_won - ?, matches_lost = matches_lost - ? WHERE account_id = ?`);
      const stmtRemoveMatch = db.prepare('DELETE FROM matches WHERE match_id = ?');

      // Revert mmr for all winners and adjust matches won/lost if not a tie
      winners.forEach(player => {
        stmtUpdatePlayer.run(player.mmr_delta, isTie ? 0 : 1, 0, player.id);
      });

      // Revert mmr for all losers and adjust matches won/lost if not a tie
      losers.forEach(player => {
        stmtUpdatePlayer.run(player.mmr_delta, 0, isTie ? 0 : 1, player.id);
      });

      // Remove the match entry
      stmtRemoveMatch.run(match_id);

      // Adjust autoincrement sequence if no matches are left
      const maxId = db.prepare('SELECT MAX(match_id) AS max_id FROM matches').get().max_id;

      if (maxId != null) {
        db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(maxId, 'matches');
      }
      else {
        db.prepare('UPDATE sqlite_sequence SET seq = 0 WHERE name = ?').run('matches');
      }
    })(); // Execute the transaction

    res.json({ message: 'Match reverted successfully' });
  }
  catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
