const express = require('express');
const router = express.Router();
const db = require('./db');
const { timeAgoShort } = require('./utilities/timeAgo');
const { parentOf } = require('./ranked_rules');
const { formatMMRDelta, getRank, countryCodeToEmoji, accountLabel } = require('./utils');
const { getAvatar } = require('./avatars');

router.get('/:user', function(req, res) {
  try {
    const userid = req.params.user;
    const match = userid.match(/^(steam|discord|crazygames|key)_(.+)$/);
    if (!match) {
      return res.status(404).render('404', { page: 'Not Found', user: req.user });
    }
    
    const [, platform, id] = match;
    const config = require('./config');
    const validId =
      config.IS_PROD ? (
        (platform === 'steam' || platform === 'discord') ? /^\d+$/.test(id) :
        (platform === 'crazygames') ? /^[A-Za-z0-9_-]{1,64}$/.test(id) :
        (platform === 'key') ? /^[0-9a-f]{64}$/.test(id) :
        false
      ) : true;
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
      },
      key: {
        name: 'Game key',
        url: null,
        icon: 'fa-solid fa-key'
      }
    };
    const { name: platformName, url: profileUrl, icon: platformIconClass } = platforms[platform];
    // A key or a Discord account linked to a Steam account plays as it; a Steam account can have several linked
    // (a Discord account and up to 10 game keys) - the Discord one first, then by id
    const linkedTo = parentOf(userid);

    // The name an account last played as - none for one that never played (e.g. a key made and linked right away)
    const stmtNickname = db.prepare(`
      SELECT nickname FROM last_nicknames WHERE account_id = @id
      UNION ALL SELECT nickname FROM mmr_team WHERE account_id = @id
      UNION ALL SELECT nickname FROM mmr_ffa WHERE account_id = @id
    `);
    const nicknameOf = id => {
      const found = stmtNickname.all({ id }).find(r => r.nickname);
      return found ? found.nickname : null;
    };

    // Secondary accounts: only those with progress of their own, by the name they played as - a bare key says nothing
    const secondaryAccounts = linkedTo ? [] : db.prepare("SELECT child_id FROM associations WHERE parent_id = ? ORDER BY child_id NOT LIKE 'discord_%', child_id")
      .all(userid)
      .map(r => ({ id: r.child_id, nickname: nicknameOf(r.child_id) }))
      .filter(a => a.nickname);
    const linkedToName = linkedTo ? (nicknameOf(linkedTo) || accountLabel(linkedTo)) : null;
    
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
    // LIKE also matches a nickname that holds the id (or an id that holds this one) - those matches are not this player's
    const matches = stmt.all(`%${userid}%`, `%${userid}%`).filter(match => {
      return JSON.parse(match.winners).some(w => w.id === userid) || JSON.parse(match.losers).some(l => l.id === userid);
    }).map(match => {
      const winnersArray = JSON.parse(match.winners);
      const losersArray = JSON.parse(match.losers);
      const winner = winnersArray.find(w => w.id === userid);
      const loser = losersArray.find(l => l.id === userid);
      const isWin = !!winner;
      const playerData = isWin ? winner : loser;
      const opponentArray = isWin ? losersArray : winnersArray.filter(w => w.contributed_as_enemy);
      const result = isWin ? `<span class="u">${match.win_score}:${match.lose_score}</span>` : `<span class="d">${match.win_score}:${match.lose_score}</span>`;
      return {
        server_emoji: countryCodeToEmoji(match.server_id.slice(0, 2)),
        game_mode: match.game_mode,
        arena: match.arena,
        new_mmr: (playerData.new_mmr).toFixed(2),
        time_ago: timeAgoShort(match.match_end_date),
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
    
    // An account with no match yet (e.g. a key that was just made, or linked before it played) still has a page
    const playedAny = matches.length > 0 || !!stmtTeam.get(userid) || !!stmtFFA.get(userid);
    const lastNickname = db.prepare('SELECT nickname FROM last_nicknames WHERE account_id = ?').get(userid);
    const nickname = (lastNickname && lastNickname.nickname) || userTeam.nickname || userFFA.nickname ||
      (platform === 'key' ? accountLabel(userid) : 'Unknown');

    res.render('user', {
      page: nickname,
      user: req.user,
      nickname,
      userid,
      hasAvatar: !!getAvatar(userid),
      playedAny,
      platformName: platformName,
      profileUrl: profileUrl,
      platformIconClass: platformIconClass,
      teamData: userTeam,
      ffaData: userFFA,
      matches: matches,
      linkedTo,
      linkedToName,
      secondaryAccounts,
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