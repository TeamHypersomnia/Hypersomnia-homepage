const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const dbPath = process.env.DB_PATH;
const { lose_severity, severityToString } = require('./lose_severity');
const formatMMRDelta = require('./format_delta');

router.get('/:user', function (req, res) {
  try {
    const db = new Database(dbPath);
    const userid = req.params.user;

    const stmtTeam = db.prepare('SELECT * FROM mmr_team WHERE account_id = ?');
    const userTeam = stmtTeam.get(userid) || { mmr: 0, sigma: 0, mu: 0 };

    const stmtFFA = db.prepare('SELECT * FROM mmr_ffa WHERE account_id = ?');
    const userFFA = stmtFFA.get(userid) || { mmr: 0, sigma: 0, mu: 0 };

    const stmtMatches = db.prepare(`
      SELECT match_id, match_date, winners, losers, lose_score, win_score 
      FROM matches 
      WHERE losers LIKE ? AND game_mode = 'bomb_defusal'
      ORDER BY match_id DESC
    `);
    const matches = stmtMatches.all(`%${userid}%`).map(match => {
      const losersArray = JSON.parse(match.losers);
      const loser = losersArray.find(l => l.id === userid);

      if (loser === undefined) {
        return null;
      }

      const winnersArray = JSON.parse(match.winners);
      const winnerNicknames = winnersArray.map((winner, idx) => {
        const delta = formatMMRDelta(winner.mmr_delta);
        const link = `<a href="/user/${winner.id}">${winner.nickname}</a> ${delta}`;
        return link;
      });

      const formattedWinnerNicknames = winnerNicknames.length > 1 
        ? winnerNicknames.slice(0, -1).join(', ') + ' and ' + winnerNicknames.slice(-1)
        : winnerNicknames.join('');

      // Assume loserDelta is also needed, using similar logic
      const loserDelta = formatMMRDelta(loser.mmr_delta);

      return {
        date: new Date(match.match_date).toLocaleString(),
        description: `<b>${severityToString(lose_severity(match.win_score, match.lose_score))} ${loserDelta} </b>by ${formattedWinnerNicknames}.`
      };
    }).filter(match => match !== null);

    res.render('user', {
      page: userTeam.nickname,
      user: req.user,
      nickname: userTeam.nickname || userFFA.nickname,
      steamId: userid.split('_')[1],
      teamData: userTeam,
      ffaData: userFFA,
      matches: matches
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
