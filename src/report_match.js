const express = require('express');
const Database = require('better-sqlite3');
const { rating, rate, ordinal } = require('openskill');

const router = express.Router();
const dbPath = process.env.DB_PATH;

// Middleware for API key authentication
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers["apikey"];
  if (apiKey && apiKey === process.env.REPORT_MATCH_APIKEY) {
    return next();
  } else {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

router.post('/', apiKeyAuth, (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { win_score, lose_score, win_players, lose_players, nicknames } = req.body;

  // Validate input
  if (!win_score || !lose_score || !win_players || !lose_players || !nicknames) {
    return res.status(400).json({ error: 'Invalid input format' });
  }

  try {
    const db = new Database(dbPath);

    db.transaction(() => {
      const allPlayers = win_players.concat(lose_players);
      const playerRatings = {};
      const default_rating = rating();
      const stmt_insert_player = db.prepare('INSERT OR IGNORE INTO players (account_id, mu, sigma) VALUES (?, ?, ?)');
      const stmt_get_player = db.prepare('SELECT mu, sigma FROM players WHERE account_id = ?');
      const stmt_update_player = db.prepare('UPDATE players SET mu = ?, sigma = ?, mmr = ?, matches_won = matches_won + ?, matches_lost = matches_lost + ?, nickname = ? WHERE account_id = ?');

      // Insert player entries if they do not exist
      allPlayers.forEach(playerId => {
        stmt_insert_player.run(playerId, default_rating.mu, default_rating.sigma);
      });

      // Read current ratings from the database
      allPlayers.forEach(playerId => {
        const row = stmt_get_player.get(playerId);
        playerRatings[playerId] = rating({ mu: row.mu, sigma: row.sigma });
      });

      // Calculate new ratings
      const winners = win_players.map(playerId => playerRatings[playerId]);
      const losers = lose_players.map(playerId => playerRatings[playerId]);
      const updatedRatings = rate([winners, losers]);

      // Update players in the database with new ratings
      updatedRatings.forEach((team, index) => {
        team.forEach((playerRating, playerIndex) => {
          const playerId = index === 0 ? win_players[playerIndex] : lose_players[playerIndex];
          const winIncrement = index === 0 ? 1 : 0;
          const lossIncrement = index === 1 ? 1 : 0;
          const mmr = ordinal(playerRating);
          const new_nickname = nicknames[playerId];

          stmt_update_player.run(playerRating.mu, playerRating.sigma, mmr, winIncrement, lossIncrement, new_nickname, playerId);
        });
      });
    })(); // Execute the transaction

    res.json({ message: 'Match reported successfully' });
  }
  catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
