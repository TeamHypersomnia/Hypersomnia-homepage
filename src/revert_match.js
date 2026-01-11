const assert = require('assert');
const express = require('express');
const db = require('./db');
const router = express.Router();

// Middleware for API key authentication using SQLite
const getServerByKey = db.prepare('SELECT server_id FROM authorized_servers WHERE api_key = ?');

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['apikey'];
  if (!apiKey) return res.status(401).json({ error: 'Unauthorized' });

  const row = getServerByKey.get(apiKey);
  if (!row) return res.status(401).json({ error: 'Unauthorized' });

  req.server_id = row.server_id;
  next();
}

router.post('/', apiKeyAuth, (req, res) => {
  const { match_id } = req.body;

  if (!match_id) return res.status(400).json({ error: 'Missing match_id' });

  try {
    db.transaction(() => {
      // Fetch the match data
      const match = db.prepare('SELECT * FROM matches WHERE match_id = ?').get(match_id);
      if (!match) throw new Error('Match not found');

      const game_mode = match.game_mode;
      const winners = JSON.parse(match.winners);
      const losers = JSON.parse(match.losers);
      const tableName = game_mode === 'FFA Gun Game' ? 'mmr_ffa' : 'mmr_team';
      const isTie = tableName === 'mmr_team' && match.win_score === 15 && match.lose_score === 15;

      // Prepare statements for reverting player MMR and match counts
      const stmtUpdatePlayer = db.prepare(`
        UPDATE ${tableName}
        SET mmr = mmr - ?, matches_won = matches_won - ?, matches_lost = matches_lost - ?
        WHERE account_id = ?
      `);
      const stmtRemoveMatch = db.prepare('DELETE FROM matches WHERE match_id = ?');

      // Revert winners
      winners.forEach(player => {
        stmtUpdatePlayer.run(player.mmr_delta, isTie ? 0 : 1, 0, player.id);
      });

      // Revert losers
      losers.forEach(player => {
        stmtUpdatePlayer.run(player.mmr_delta, 0, isTie ? 0 : 1, player.id);
      });

      // Remove the match entry
      stmtRemoveMatch.run(match_id);

      // Adjust sqlite_sequence to maintain autoincrement
      const maxIdRow = db.prepare('SELECT MAX(match_id) AS max_id FROM matches').get();
      const maxId = maxIdRow ? maxIdRow.max_id : 0;
      db.prepare('UPDATE sqlite_sequence SET seq = ? WHERE name = ?').run(maxId || 0, 'matches');

    })(); // Execute transaction

    res.json({ message: 'Match reverted successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
