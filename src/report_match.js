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

  const { server_name, arena, game_mode, win_score, lose_score, win_players, lose_players, nicknames } = req.body;

  // Validate input
  if (typeof win_score === 'undefined') {
    return res.status(400).json({ error: 'Missing win_score' });
  }

  if (typeof lose_score === 'undefined') {
    return res.status(400).json({ error: 'Missing lose_score' });
  }

  if (!win_players) {
    return res.status(400).json({ error: 'Missing win_players' });
  }

  if (!lose_players) {
    return res.status(400).json({ error: 'Missing lose_players' });
  }

  if (!nicknames) {
    return res.status(400).json({ error: 'Missing nicknames' });
  }

  if (!server_name) {
    return res.status(400).json({ error: 'Missing server_name' });
  }

  if (!arena) {
    return res.status(400).json({ error: 'Missing arena' });
  }

  if (!game_mode) {
    return res.status(400).json({ error: 'Missing game_mode' });
  }

  if (win_players.length == 0 || lose_players.length == 0) {
    return res.status(400).json({ error: 'Invalid input format: lose/win players array is empty' });
  }

  try {
    const db = new Database(dbPath);

    db.transaction(() => {
      const allPlayers = win_players.concat(lose_players);
      const playerRatings = {};
      const default_rating = rating();
      const table_name = (() => {
        if (game_mode === 'bomb_defusal') {
          return 'mmr_team';
        }

        if (game_mode === 'gun_game') {
          return 'mmr_ffa';
        }

        return 'mmr_team';
      })();

      const stmt_insert_player = db.prepare(`INSERT OR IGNORE INTO ${table_name} (account_id, mu, sigma) VALUES (?, ?, ?)`);
      const stmt_get_player = db.prepare(`SELECT mu, sigma FROM ${table_name} WHERE account_id = ?`);
      const stmt_update_player = db.prepare(`UPDATE ${table_name} SET mu = ?, sigma = ?, mmr = ?, matches_won = matches_won + ?, matches_lost = matches_lost + ?, nickname = ? WHERE account_id = ?`);

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
      const winner_ratings = win_players.map(playerId => playerRatings[playerId]);
      const loser_ratings = lose_players.map(playerId => playerRatings[playerId]);
      const updatedRatings = rate([winner_ratings, loser_ratings]);

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

      const winners = [];
      const losers = [];

      updatedRatings[0].forEach((rating, index) => {
        const player_id = win_players[index];

        winners.push({ 
          nickname: nicknames[player_id],
          id: player_id,
          new_mmr: ordinal(rating),
          mmr_delta: ordinal(rating) - ordinal(winner_ratings[index])
        });
      });

      updatedRatings[1].forEach((rating, index) => {
        const player_id = lose_players[index];

        losers.push({ 
          nickname: nicknames[player_id],
          id: player_id,
          new_mmr: ordinal(rating),
          mmr_delta: ordinal(rating) - ordinal(loser_ratings[index])
        });
      });

      const insertMatchSql = `
        INSERT INTO matches (server_name, arena, game_mode, winners, losers, win_score, lose_score)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      db.prepare(insertMatchSql).run(server_name, arena, game_mode, JSON.stringify(winners), JSON.stringify(losers), win_score, lose_score);
    })(); // Execute the transaction

    res.json({ message: 'Match reported successfully' });
  }
  catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
