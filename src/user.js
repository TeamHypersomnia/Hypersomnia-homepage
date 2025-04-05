const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const moment = require('moment');
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
    const db = new Database(process.env.DB_PATH);
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
      associatedId = Id.split('_')[0];
    }
    else if (childAssociation) {
      const Id = childAssociation.child_id;
      associationType = 'Secondary account';
      associatedProfileUrl = `/user/${Id}`;
      associatedId = Id.split('_')[0];
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
      SELECT *
      FROM matches 
      WHERE (winners LIKE ? OR losers LIKE ?)
      ORDER BY match_id DESC
    `);
    
    const matches = stmtMatches.all(`%${userid}%`, `%${userid}%`).map(match => {
      const winnersArray = JSON.parse(match.winners);
      const losersArray = JSON.parse(match.losers);
    
      const winner = winnersArray.find(w => w.id === userid);
      const loser = losersArray.find(l => l.id === userid);
    
      const isWin = !!winner;
      const playerData = isWin ? winner : loser;
    
      if (!playerData) return null;
    
      const opponentArray = isWin
      ? losersArray
      : winnersArray.filter(w => w.contributed_as_enemy);    
    
      const opponentLinks = opponentArray.map(opponent => {
        const delta = formatMMRDelta(opponent.mmr_delta);
        const escapedNickname = escapeHtml(opponent.nickname);
        return `${delta} <a href="/user/${opponent.id}">${escapedNickname}</a>`;
      });
    
      const formattedOpponentLinks = opponentLinks.join('<br>');
    
      const mmrDelta = formatMMRDelta(playerData.mmr_delta);
      const prevMMR = (playerData.new_mmr - playerData.mmr_delta).toFixed(2);
    
      let multPreffix = '';
      if (match.event_match_multiplier !== 1) {
        multPreffix = `<b style="color: orange">x${match.event_match_multiplier}</b> `;
      }

      const mmr_change = `${mmrDelta}`;
      const result = isWin ? `<span class="up">${match.win_score}:${match.lose_score}</span>` : `<span class="down">${match.win_score}:${match.lose_score}</span>`;
    
      return {
        server_id: match.server_id,
        game_mode: match.game_mode,
        arena: match.arena,
        prev_mmr: prevMMR,
        new_mmr: (playerData.new_mmr).toFixed(2),
        time_ago: moment.utc(match.match_end_date).local().fromNow(),
        mmr_change,
        multPreffix,
        result,
        formattedOpponentLinks
      };
    }).filter(match => match !== null);

    const render_data = {
      page: userTeam.nickname || userFFA.nickname || 'Unknown',
      user: req.user,
      nickname: userTeam.nickname || userFFA.nickname || 'Unknown',
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
