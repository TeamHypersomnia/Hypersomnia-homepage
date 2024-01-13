const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();
const dbPath = process.env.DB_PATH;

// Endpoint for fetching leaderboards
router.get('/', (req, res) => {
  try {
    // Open the database connection
    const db = new sqlite3.Database(dbPath);

    // Fetch all players and their match counts
    db.all('SELECT steam_id, mmr, matches_won, matches_lost FROM players', (err, rows) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      // Close the database connection
      db.close();

      // Create a JSON response with players and match counts
      const leaderboards = rows.map((row) => ({
        steam_id: row.steam_id,
        mmr: row.mmr,
        matches_won: row.matches_won,
        matches_lost: row.matches_lost
      }));

      leaderboards.sort((a, b) => b.matches_won - a.matches_won);

      if (req.query.format !== undefined && req.query.format == 'json') {
        return res.status(200).json({ leaderboards });
      }
      else {
        res.render('leaderboards', {
          page: 'Leaderboards',
          user: req.user,
          leaderboards: leaderboards
        });
      }
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
