const express = require('express');
const Database = require('better-sqlite3');

const router = express.Router();
const dbPath = process.env.DB_PATH;

// Endpoint for fetching leaderboards
router.get('/', (req, res) => {
  try {
    // Open the database connection
    const db = new Database(dbPath);

    // Prepare and execute the query to fetch all players
    const stmt = db.prepare('SELECT account_id, mmr, mu, sigma, matches_won, matches_lost, nickname FROM players');
    const rows = stmt.all();

    // Create a JSON response with players and match counts
    const leaderboards = rows.map((row) => ({
      account_id: row.account_id,
      nickname: row.nickname,
      mmr: row.mmr,
      mu: row.mu,
      sigma: row.sigma,
      matches_won: row.matches_won,
      matches_lost: row.matches_lost
    }));

    leaderboards.sort((a, b) => b.mmr - a.mmr);

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
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
