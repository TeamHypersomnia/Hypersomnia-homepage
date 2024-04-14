const express = require('express');
const Database = require('better-sqlite3');
const formatMMRDelta = require('./format_delta');
const moment = require('moment');

const router = express.Router();
const dbPath = process.env.DB_PATH;

router.get('/', (req, res) => {
  try {
    // Open the database connection
    const db = new Database(dbPath);

    // Prepare and execute the query to fetch all matches
    const stmt = db.prepare('SELECT * FROM matches');
    const rows = stmt.all();

    // Create a response array with detailed match information
    const matches = rows.map(match => {
      // Parse winner and loser IDs from JSON strings
      const winners = JSON.parse(match.winners);
      const losers = JSON.parse(match.losers);

      // Return the detailed match information
      return {
        match_id: match.match_id,
        server_name: match.server_name,
        server_id: match.server_id,
        arena: match.arena,
        game_mode: match.game_mode,
        winners,
        losers,
        win_score: match.win_score,
        lose_score: match.lose_score,
        match_end_date: match.match_end_date,
        time_ago: moment(match.match_end_date, "YYYY-MM-DD HH:mm:ss").fromNow(),
        match_start_date: match.match_start_date,
        event_match_multiplier: match.event_match_multiplier,
        is_ffa: match.game_mode === 'FFA Gun Game'
      };
    });

    matches.sort((a, b) => b.match_id - a.match_id);

    if (req.query.format !== undefined && req.query.format == 'json') {
      return res.status(200).json({ matches });
    }
    else {
      res.render('matches', {
        page: 'Matches',
        user: req.user,
        matches: matches,
        formatMMRDelta: formatMMRDelta
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
