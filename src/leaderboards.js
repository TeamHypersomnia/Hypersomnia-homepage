const express = require('express');
const Database = require('better-sqlite3');
const { getRank } = require('./utils');
const router = express.Router();

router.get('/', (req, res) => {
  if (req.query?.format !== 'json') {
    return res.redirect('/leaderboards/bomb-defusal');
  }

  try {
    const db = new Database('./private/mmr.db');
    const leaderboards = {
      leaderboards_team: db.prepare('SELECT account_id, nickname, mmr FROM mmr_team ORDER BY mmr DESC').all(),
      leaderboards_ffa: db.prepare('SELECT account_id, nickname, mmr FROM mmr_ffa ORDER BY mmr DESC').all()
    };
    return res.json(leaderboards);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/bomb-defusal', (req, res) => {
  try {
    const db = new Database('./private/mmr.db');
    const rows = db.prepare('SELECT * FROM mmr_team ORDER BY mmr DESC').all();
    const leaderboards = rows.map(row => ({
      ...row,
      ...getRank(row.mmr)
    }));

    if (req.query?.format === 'json') {
      return res.json(leaderboards);
    }

    res.render('leaderboards', {
      page: 'Leaderboards',
      user: req.user,
      leaderboard_name: 'Bomb Defusal',
      leaderboards
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/ffa', (req, res) => {
  try {
    const db = new Database('./private/mmr.db');
    const rows = db.prepare('SELECT * FROM mmr_ffa ORDER BY mmr DESC').all();
    const leaderboards = rows.map(row => ({
      ...row,
      ...getRank(row.mmr)
    }));

    if (req.query?.format === 'json') {
      return res.json(leaderboards);
    }

    res.render('leaderboards', {
      page: 'Leaderboards',
      user: req.user,
      leaderboard_name: 'FFA',
      leaderboards
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
