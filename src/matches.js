const express = require('express');
const db = require('./db');
const moment = require('moment');
const { formatMMRDelta, countryCodeToEmoji } = require('./utils'); // Use emoji from utils
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM matches ORDER BY match_id DESC LIMIT 50').all();

    const matches = rows.map(match => {
      const winners = JSON.parse(match.winners);
      const losers = JSON.parse(match.losers);

      return {
        server_emoji: countryCodeToEmoji(match.server_id.slice(0, 2)), // <-- updated
        arena: match.arena,
        game_mode: match.game_mode,
        winners,
        losers,
        win_score: match.win_score,
        lose_score: match.lose_score,
        match_end_date: match.match_end_date,
        time_ago: moment.utc(match.match_end_date).local().fromNow(),
        event_match_multiplier: match.event_match_multiplier,
        is_ffa: match.game_mode === 'FFA Gun Game'
      };
    });

    res.render('matches', {
      page: 'Matches',
      user: req.user,
      matches,
      formatMMRDelta
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
