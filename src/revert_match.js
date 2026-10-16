const assert = require('assert');
const express = require('express');
const db = require('./db');
const router = express.Router();

const { officialServerAuth } = require('./official_servers');
// A revert sent again finds no match - nothing to guard against a replay
const apiKeyAuth = officialServerAuth({ tag: 'hs-revert-v1' });

router.post('/', apiKeyAuth, (req, res) => {
  const { match_id } = req.body;

  if (!match_id) return res.status(400).json({ error: 'Missing match_id' });

  try {
    db.transaction(() => {
      // Fetch the match data
      const match = db.prepare('SELECT * FROM matches WHERE match_id = ?').get(match_id);
      if (!match) {
        const error = new Error(`Match ${match_id} not found`);
        error.status = 404;
        throw error;
      }

      // A server can revert only the matches it reported itself
      if (match.server_id !== req.server_id) {
        const error = new Error(`Server ${req.server_id} can not revert match ${match_id} of ${match.server_id}`);
        error.status = 403;
        throw error;
      }

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

      // Matches reported since report_match.js records exactly what it changed
      const stmtRevertRecorded = db.prepare(`
        UPDATE ${tableName}
        SET mu = mu - ?, sigma = sigma - ?, mmr = mmr - ?, matches_won = matches_won - ?, matches_lost = matches_lost - ?
        WHERE account_id = ?
      `);

      const revertRecorded = (player) => {
        if (typeof player.won !== 'number') return false;

        stmtRevertRecorded.run(player.mu_delta, player.sigma_delta, player.mmr_delta, player.won, player.lost, player.id);
        return true;
      };
      const stmtRemoveMatch = db.prepare('DELETE FROM matches WHERE match_id = ?');

      // Revert winners
      winners.forEach(player => {
        if (!revertRecorded(player)) stmtUpdatePlayer.run(player.mmr_delta, isTie ? 0 : 1, 0, player.id);
      });

      // Revert losers
      losers.forEach(player => {
        if (!revertRecorded(player)) stmtUpdatePlayer.run(player.mmr_delta, 0, isTie ? 0 : 1, player.id);
      });

      // Remove the match entry
      if (match.report_id) {
        db.prepare('INSERT OR IGNORE INTO reverted_reports (report_id) VALUES (?)').run(match.report_id);
      }

      stmtRemoveMatch.run(match_id);

      // The id of a reverted match is never given to another one: a retried revert would revert that one instead

    })(); // Execute transaction

    res.json({ message: 'Match reverted successfully' });
  } catch (error) {
    console.error(error.message);

    if (error.status === 403) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (error.status === 404) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (error.status === 403) {
      return res.status(403).json({ error: 'Another server reported this match' });
    }

    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
