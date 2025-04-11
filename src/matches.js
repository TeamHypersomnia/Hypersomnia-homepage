const express = require('express');
const Database = require('better-sqlite3');
const moment = require('moment');
const { countryCodeEmoji } = require('country-code-emoji');
const { formatMMRDelta } = require('./utils');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const db = new Database(process.env.DB_PATH);
    const rows = db.prepare('SELECT * FROM matches ORDER BY match_id DESC LIMIT 100').all();
    const matches = rows.map(match => {
      const winners = JSON.parse(match.winners);
      const losers = JSON.parse(match.losers);
      return {
        server_emoji: countryCodeEmoji(match.server_id.slice(0, 2)),
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
      matches: matches,
      formatMMRDelta: formatMMRDelta
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
