const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const moment = require('moment');
const { formatMMRDelta, getRank } = require('./utils');
const { countryCodeEmoji } = require('country-code-emoji');

router.get('/:user', function (req, res) {
  try {
    const userid = req.params.user;
    const match = userid.match(/^(steam|discord|crazygames)_(.+)$/);
    if (!match) {
      return res.status(404).render('404', { page: 'Not Found', user: req.user });
    }
    
    const [ , platform, id ] = match;
    const validId =
      (platform === 'steam' || platform === 'discord') ? /^\d+$/.test(id) :
      (platform === 'crazygames') ? /^[a-zA-Z0-9]{10,64}$/.test(id) :
      false;
    if (!validId) {
      return res.status(404).render('404', { page: 'Not Found', user: req.user });
    }
    const platforms = {
      steam: {
        name: 'Steam',
        url: `https://steamcommunity.com/profiles/${id}`,
        icon: 'fa-brands fa-steam'
      },
      discord: {
        name: 'Discord',
        url: `https://discord.com/users/${id}`,
        icon: 'fa-brands fa-discord'
      },
      crazygames: {
        name: 'CrazyGames',
        url: `https://www.crazygames.com/uid/${id}`,
        icon: ''
      }
    };
    const { name: platformName, url: profileUrl, icon: platformIconClass } = platforms[platform];    

    const db = new Database(process.env.DB_PATH);
    const parentAssociation = db.prepare('SELECT parent_id FROM associations WHERE child_id = ?').get(userid);
    const childAssociation  = db.prepare('SELECT child_id FROM associations WHERE parent_id = ?').get(userid);
    let associationType = null;
    let associatedProfileUrl = null;
    let associatedId = null;
    if (parentAssociation) {
      const Id = parentAssociation.parent_id;
      associationType = 'Primary account';
      associatedProfileUrl = `/user/${Id}`;
      associatedId = Id.split('_')[0];
    } else if (childAssociation) {
      const Id = childAssociation.child_id;
      associationType = 'Secondary account';
      associatedProfileUrl = `/user/${Id}`;
      associatedId = Id.split('_')[0];
    }

    const stmtTeam = db.prepare('SELECT * FROM mmr_team WHERE account_id = ?');
    const userTeam = stmtTeam.get(userid) || { mmr: 0, sigma: 0, mu: 0, matches_won: 0, matches_lost: 0 };
    const rankTeam = getRank(userTeam.mmr);
    userTeam.rankImg = rankTeam.rankImg;
    userTeam.rankName = rankTeam.rankName;

    const stmtFFA = db.prepare('SELECT * FROM mmr_ffa WHERE account_id = ?');
    const userFFA = stmtFFA.get(userid) || { mmr: 0, sigma: 0, mu: 0, matches_won: 0, matches_lost: 0 };
    const rankFFA = getRank(userFFA.mmr);
    userFFA.rankImg = rankFFA.rankImg;
    userFFA.rankName = rankFFA.rankName;

    const stmt = db.prepare(`SELECT * FROM matches WHERE (winners LIKE ? OR losers LIKE ?) ORDER BY match_id DESC`);
    const matches = stmt.all(`%${userid}%`, `%${userid}%`).map(match => {
      const winnersArray = JSON.parse(match.winners);
      const losersArray = JSON.parse(match.losers);
      const winner = winnersArray.find(w => w.id === userid);
      const loser = losersArray.find(l => l.id === userid);
      const isWin = !!winner;
      const playerData = isWin ? winner : loser;
      const opponentArray = isWin ? losersArray : winnersArray.filter(w => w.contributed_as_enemy);
      const result = isWin ? `<span class="u">${match.win_score}:${match.lose_score}</span>` : `<span class="d">${match.win_score}:${match.lose_score}</span>`;
      return {
        server_emoji: countryCodeEmoji(match.server_id.slice(0, 2)),
        game_mode: match.game_mode,
        arena: match.arena,
        new_mmr: (playerData.new_mmr).toFixed(2),
        time_ago: moment.utc(match.match_end_date).local().fromNow(),
        mmrDelta: playerData.mmr_delta,
        multPreffix: match.event_match_multiplier,
        result,
        opponentArray,
        isWin
      };
    });

    let longestWinStreak = 0;
    let currentWinStreak = 0;
    matches.forEach(match => {
      if (match.isWin) {
        currentWinStreak++;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else {
        currentWinStreak = 0;
      }
    });

    const arenaCounts = {};
    matches.forEach(match => {
      const arena = match.arena;
      arenaCounts[arena] = (arenaCounts[arena] || 0) + 1;
    });
    const mostPlayedArena = Object.keys(arenaCounts).reduce((a, b) => arenaCounts[a] > arenaCounts[b] ? a : b, null);
    const mostPlayedArenaCount = mostPlayedArena ? arenaCounts[mostPlayedArena] : 0;

    res.render('user', {
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
      associatedId: associatedId,
      formatMMRDelta: formatMMRDelta,
      longestWinStreak,
      mostPlayedArena,
      mostPlayedArenaCount
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
