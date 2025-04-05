const express = require('express');
const Database = require('better-sqlite3');
const ranks = require('./ranks_info');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const db = new Database(process.env.DB_PATH);
    const rows_team = db.prepare('SELECT account_id, nickname, mmr FROM mmr_team').all();
    const rows_ffa = db.prepare('SELECT account_id, nickname, mmr FROM mmr_ffa').all();
    const row_reader = (row) => ({
      account_id: row.account_id,
      nickname: row.nickname,
      mmr: row.mmr.toFixed(2),
      //mu: row.mu,
      //sigma: row.sigma,
      //matches_won: row.matches_won,
      //matches_lost: row.matches_lost
    });

    const leaderboards_team = rows_team.map(row_reader);
    leaderboards_team.sort((a, b) => b.mmr - a.mmr);

    const leaderboards_ffa = rows_ffa.map(row_reader);
    leaderboards_ffa.sort((a, b) => b.mmr - a.mmr);

    if (req.query.format !== undefined && req.query.format == 'json') {
      return res.status(200).json({ leaderboards_team, leaderboards_ffa });
    } else {
      return res.redirect('/leaderboards/bomb-defusal');
    }
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/bomb-defusal', (req, res) => {
  try {
    const db = new Database(process.env.DB_PATH);
    const rows_team  = db.prepare('SELECT account_id, mmr, mu, sigma, matches_won, matches_lost, nickname FROM mmr_team').all();

    const row_reader = (row) => {
      const rank = ranks.getRank(parseInt(row.mmr));
      return {
        account_id: row.account_id,
        nickname: row.nickname,
        mmr: row.mmr,
        mu: row.mu,
        sigma: row.sigma,
        matches_won: row.matches_won,
        matches_lost: row.matches_lost,
        rankImg: rank.rankImg,
        rankName: rank.rankName
      };
    };

    const leaderboards_team = rows_team.map(row_reader);
    leaderboards_team.sort((a, b) => b.mmr - a.mmr);

    if (req.query.format !== undefined && req.query.format == 'json') {
      return res.status(200).json({ leaderboards_team });
    } else {
      res.render('leaderboards', {
        page: 'Leaderboards',
        user: req.user,
        leaderboard_name: 'Bomb Defusal',
        leaderboards: leaderboards_team,
        bomb_defusal: true,
        ffa: false
      });
    }
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/ffa', (req, res) => {
  try {
    const db = new Database(process.env.DB_PATH);
    const rows_ffa = db.prepare('SELECT account_id, mmr, mu, sigma, matches_won, matches_lost, nickname FROM mmr_ffa').all();

    const row_reader = (row) => {
      const rank = ranks.getRank(parseInt(row.mmr));
      return {
        account_id: row.account_id,
        nickname: row.nickname,
        mmr: row.mmr,
        mu: row.mu,
        sigma: row.sigma,
        matches_won: row.matches_won,
        matches_lost: row.matches_lost,
        rankImg: rank.rankImg,
        rankName: rank.rankName
      };
    };

    const leaderboards_ffa = rows_ffa.map(row_reader);
    leaderboards_ffa.sort( (a, b) => b.mmr - a.mmr);

    if (req.query.format !== undefined && req.query.format == 'json') {
      return res.status(200).json({ leaderboards_ffa });
    } else {
      res.render('leaderboards', {
        page: 'Leaderboards',
        user: req.user,
        leaderboard_name: 'FFA',
        leaderboards: leaderboards_ffa,
        bomb_defusal: false,
        ffa: true
      });
    }
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
