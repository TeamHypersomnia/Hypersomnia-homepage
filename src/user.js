const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const moment = require('moment');
const dbPath = process.env.DB_PATH;
const { lose_severity, severityToString } = require('./lose_severity');
const formatMMRDelta = require('./format_delta');
const ranks = require('./ranks_info');

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

router.get('/:user', function (req, res) {
  try {
    const db = new Database(dbPath);
    const userid = req.params.user;
    
    const isSteamUser = userid.startsWith('steam_');
    const isDiscordUser = userid.startsWith('discord_');
    const isCrazyGamesUser = userid.startsWith('crazygames_');
    let platformName, profileUrl, platformIconClass;

    if (isSteamUser) {
      platformName = 'Steam';
      profileUrl = `https://steamcommunity.com/profiles/${userid.split('_')[1]}`;
      platformIconClass = 'fa-brands fa-steam';
    }
    else if (isDiscordUser) {
      platformName = 'Discord';
      profileUrl = `https://discord.com/users/${userid.split('_')[1]}`;
      platformIconClass = 'fa-brands fa-discord';
    }
    else if (isCrazyGamesUser) {
      platformName = 'CrazyGames';
      profileUrl = `https://www.crazygames.com/uid/${userid.split('_')[1]}`;

      /* A crazygames image will be used instead */
      platformIconClass = '';
    }
    else {
      platformName = 'Unknown';
      profileUrl = '#';
      platformIconClass = 'fa-question';
    }

    // Check for associations
    let associationType = null;
    let associatedProfileUrl = null;
    let associatedId = null;

    const parentAssociation = db.prepare('SELECT parent_id FROM associations WHERE child_id = ?').get(userid);
    const childAssociation  = db.prepare('SELECT child_id FROM associations WHERE parent_id = ?').get(userid);

    if (parentAssociation) {
      const Id = parentAssociation.parent_id;
      associationType = 'Primary account';
      associatedProfileUrl = `/user/${Id}`;
      associatedId = Id;
    }
    else if (childAssociation) {
      const Id = childAssociation.child_id;
      associationType = 'Secondary account';
      associatedProfileUrl = `/user/${Id}`;
      associatedId = Id;
    }

    const stmtTeam = db.prepare('SELECT * FROM mmr_team WHERE account_id = ?');
    const userTeam = stmtTeam.get(userid) || { mmr: 0, sigma: 0, mu: 0, matches_won: 0, matches_lost: 0 };
    const rankTeam = ranks.getRank(parseInt(userTeam.mmr));
    userTeam.rankImg = rankTeam.rankImg;
    userTeam.rankName = rankTeam.rankName;

    const stmtFFA = db.prepare('SELECT * FROM mmr_ffa WHERE account_id = ?');
    const userFFA = stmtFFA.get(userid) || { mmr: 0, sigma: 0, mu: 0, matches_won: 0, matches_lost: 0 };
    const rankFFA = ranks.getRank(parseInt(userFFA.mmr));
    userFFA.rankImg = rankFFA.rankImg;
    userFFA.rankName = rankFFA.rankName;

    
    const stmtMatches = db.prepare(`
      SELECT match_id, match_end_date, winners, losers, lose_score, win_score, event_match_multiplier
      FROM matches 
      WHERE losers LIKE ? AND game_mode = 'Bomb Defusal'
      ORDER BY match_id DESC
    `);
    const matches = stmtMatches.all(`%${userid}%`).map(match => {
      const losersArray = JSON.parse(match.losers);
      const loser = losersArray.find(l => l.id === userid);

      if (loser === undefined) {
        return null;
      }

      const winnersArrayUnfiltered = JSON.parse(match.winners);
      const winnersArray = winnersArrayUnfiltered.filter((winner) => (winner.contributed_as_enemy));

      const winnerNicknames = winnersArray.map((winner, idx) => {
        const delta = formatMMRDelta(winner.mmr_delta);
        const escapedWinnerNickname = escapeHtml(winner.nickname);

        const link = `<a href="/user/${winner.id}">${escapedWinnerNickname}</a> ${delta}`;
        return link;
      });

      const formattedWinnerNicknames = winnerNicknames.length > 1 
        ? winnerNicknames.slice(0, -1).join(', ') + ' and ' + winnerNicknames.slice(-1)
        : winnerNicknames.join('');

      // Assume loserDelta is also needed, using similar logic
      const loserDelta = formatMMRDelta(loser.mmr_delta);
      const prev_loser_mmr = (loser.new_mmr - loser.mmr_delta).toFixed(2);

      let multPreffix = '';

      if (match.event_match_multiplier !== 1) {
        multPreffix = `<b style="color: orange">(${match.event_match_multiplier}x)</b> `;
      }

      return {
        prev_mmr: prev_loser_mmr,
        new_mmr: loser.new_mmr,
        time_ago: moment.utc(match.match_end_date).local().fromNow(),
        description: `<b>${multPreffix}${severityToString(lose_severity(match.win_score, match.lose_score))} ${loserDelta}</b> by ${formattedWinnerNicknames}.`
      };
    }).filter(match => match !== null);

    const render_data = {
      page: userTeam.nickname || userFFA.nickname,
      user: req.user,
      nickname: userTeam.nickname || userFFA.nickname,
      platformName: platformName,
      profileUrl: profileUrl,
      platformIconClass: platformIconClass,
      teamData: userTeam,
      ffaData: userFFA,
      matches: matches,
      associationType: associationType,
      associatedProfileUrl: associatedProfileUrl,
      associatedId: associatedId
    };

    res.render('user', render_data);
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
