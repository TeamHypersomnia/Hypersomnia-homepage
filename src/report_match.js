const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();
const dbPath = process.env.DB_PATH;

// Middleware for API key authentication
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers["apikey"];

  // Check if the API key is valid (replace 'your-api-key' with the actual API key)
  if (apiKey && apiKey === process.env.REPORT_MATCH_APIKEY) {
    return next();
  } else {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

router.post('/', apiKeyAuth, async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { win_score, lose_score, win_players, lose_players } = req.body;

  // Validate input
  if (!win_score || !lose_score || !win_players || !lose_players) {
    return res.status(400).json({ error: 'Invalid input format' });
  }

  try {
    const db = new sqlite3.Database(dbPath);

    // Start a transaction to handle multiple queries
    db.serialize(() => {
      const stmtInsertPlayer = db.prepare('INSERT OR IGNORE INTO players (steam_id) VALUES (?)');
      const stmtUpdateMatchesWon = db.prepare('UPDATE players SET matches_won = matches_won + 1 WHERE steam_id = ?');
      const stmtUpdateMatchesLost = db.prepare('UPDATE players SET matches_lost = matches_lost + 1 WHERE steam_id = ?');

      // Process win players
      win_players.forEach((player) => {
        // Insert the player if not already exists
        stmtInsertPlayer.run(player);

        // Increment matches_won for the player
        stmtUpdateMatchesWon.run(player);
      });

      // Process lose players
      lose_players.forEach((player) => {
        // Insert the player if not already exists
        stmtInsertPlayer.run(player);

        // Increment matches_lost for the player
        stmtUpdateMatchesLost.run(player);
      });

      // Finalize the statements
      stmtInsertPlayer.finalize();
      stmtUpdateMatchesWon.finalize();
      stmtUpdateMatchesLost.finalize();
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
