const express = require('express');
const db = require('./db');
const { rating, rate, ordinal } = require('openskill');

const router = express.Router();

const MIN_SCORE_AS_TEAMMATE_TO_CONTRIBUTE = 13;
const MIN_SCORE_AS_ENEMY_TO_CONTRIBUTE = 4;
const MIN_ROUNDS_TO_COUNT_WINS = 5;

// A queued report (the site was down) is taken this long after it was made - the game drops older ones itself
const MAX_REPORT_AGE_SECS = 3 * 24 * 60 * 60;

const { officialServerAuth } = require('./official_servers');
const { mmrTableOf, isTie, parentOf } = require('./ranked_rules');
const { parseAvatar, setAvatar, isValidAccountId } = require('./avatars');
const signedByOfficialServer = officialServerAuth({ tag: 'hs-report-v1' });

// Player helpers
const abandoned = (player) => typeof player.abandoned_at_score === 'number' && player.abandoned_at_score >= 0;
function allAbandoned(playerInfos) {
  return Object.values(playerInfos).every(abandoned);
}
const contributed_to_match = (player, is_teammate) => {
  if (abandoned(player)) {
    return is_teammate
      ? player.abandoned_at_score >= MIN_SCORE_AS_TEAMMATE_TO_CONTRIBUTE
      : player.abandoned_at_score >= MIN_SCORE_AS_ENEMY_TO_CONTRIBUTE;
  }
  return true;
};

// Other helpers
function lose_severity(win, lose) {
  const diff = win - lose;
  if (diff >= 13) return 3;
  if (diff >= 8) return 2;
  return 1;
}

/*
  An account linked to a Steam account plays as it (the game reports a linked key as the Steam account already).
  A Steam account can have several linked, so one match could hold two of them: only the first one
  in the report (winners before losers) plays as the Steam account, the others stay themselves -
  otherwise one account would be counted twice, possibly on both teams.

  A linked key is reported as the Steam account whenever the player has the broker's cert for it. Reported as itself
  (the sign-in failed, or the player removed steam.cert), it stays itself: its own MMR row, hidden from the leaderboards
  while it is linked - what the game tells the player ("will not count towards your Steam account").
*/
function buildIdMapping(winPlayers, losePlayers, db) {
  const allIds = winPlayers.concat(losePlayers);
  const taken = new Set(allIds);
  const mapping = new Map();

  for (const id of allIds) {
    const parent = id.startsWith('key_') ? null : parentOf(id);

    if (parent && !taken.has(parent)) {
      taken.add(parent);
      mapping.set(id, parent);
    }
    else {
      mapping.set(id, id);
    }
  }

  return mapping;
}

function mapPlayerInfos(playerInfos, mapping) {
  const updatedPlayerInfos = {};

  for (const [id, info] of Object.entries(playerInfos)) {
    updatedPlayerInfos[mapping.get(id) || id] = info;
  }

  return updatedPlayerInfos;
}

// Route
router.post('/', signedByOfficialServer, (req, res) => {
  const { match_start_date, server_name, arena, game_mode, win_score, lose_score } = req.body;
  let { losers_abandoned, win_players, lose_players, player_infos } = req.body;

  // Validation
  if (win_score == null || lose_score == null || !win_players || !lose_players || !player_infos || !server_name || !arena || !game_mode || !match_start_date) {
    console.error('[report_match] Validation failed: missing required match data.', JSON.stringify({ server_name, arena, game_mode, win_score, lose_score, has_win_players: !!win_players, has_lose_players: !!lose_players, has_player_infos: !!player_infos, match_start_date }));
    return res.status(400).json({ error: 'Missing required match data' });
  }
  // Shown as they are on players' pages - only whole numbers, whatever a server sends
  if (!Number.isInteger(win_score) || !Number.isInteger(lose_score) || win_score < 0 || lose_score < 0) {
    return res.status(400).json({ error: 'The scores must be whole numbers' });
  }
  if (win_players.length === 0 || lose_players.length === 0) {
    console.error('[report_match] Validation failed: empty player arrays.', JSON.stringify({ win_players_len: win_players.length, lose_players_len: lose_players.length }));
    return res.status(400).json({ error: 'Player arrays cannot be empty' });
  }
  losers_abandoned = losers_abandoned || false;

  // Only accounts someone vouched for - never nick_ ones (nickname auth: anyone could take the name)
  const invalid = [...win_players, ...lose_players].find(id => !isValidAccountId(id));

  if (invalid !== undefined) {
    console.error('[report_match] Refused: an account id that is not steam_/crazygames_/key_.', JSON.stringify({ server_name, server_id: req.server_id, invalid }));
    return res.status(400).json({ error: 'Invalid account id' });
  }

  /*
    The game server's id of the match: the same report retried after an answer it did not get is not counted twice.
  */
  const report_id = typeof req.body.match_id === 'string' && /^[0-9a-f]{1,64}$/.test(req.body.match_id) ? req.body.match_id : null;
  const reported_at = req.body.reported_at;

  // Both are signed with the body: without them a recorded report could be sent again
  if (!report_id || typeof reported_at !== 'number') {
    console.error('[report_match] Validation failed: no match_id or reported_at.', JSON.stringify({ server_name, server_id: req.server_id }));
    return res.status(400).json({ error: 'Missing match_id or reported_at' });
  }

  if (db.prepare('SELECT 1 FROM matches WHERE report_id = ?').get(report_id) || db.prepare('SELECT 1 FROM reverted_reports WHERE report_id = ?').get(report_id)) {
    return res.status(409).json({ error: 'Already reported' });
  }

  if (Math.abs(Date.now() / 1000 - reported_at) > MAX_REPORT_AGE_SECS) {
    console.error('[report_match] Refused: reported too long ago.', JSON.stringify({ server_name, server_id: req.server_id, reported_at }));
    return res.status(400).json({ error: 'Report too old' });
  }

  if (allAbandoned(player_infos)) {
    console.log('[report_match] Skipping match report: all players abandoned.', JSON.stringify({ server_name, arena, game_mode }));
    return res.json({ message: 'Skipping match report. All players abandoned the match' });
  }

  try {
    if (new Set(win_players.concat(lose_players)).size !== win_players.length + lose_players.length) {
      console.error('[report_match] Validation failed: a player is listed twice.', JSON.stringify({ server_name, server_id: req.server_id }));
      return res.status(400).json({ error: 'A player is listed twice' });
    }

    const mapping = buildIdMapping(win_players, lose_players, db);

    win_players = win_players.map(id => mapping.get(id));
    lose_players = lose_players.map(id => mapping.get(id));
    player_infos = mapPlayerInfos(player_infos, mapping);

    /*
      Banned accounts are not rated - also a key that played on its own (e.g. after "Play without signing in")
      while it or its Steam account is banned. The others' match still counts.
    */
    const stmt_banned = db.prepare('SELECT 1 FROM broker_bans WHERE account = ?');
    const isBanned = id => {
      if (stmt_banned.get(id)) return true;
      const parent = parentOf(id);
      return !!(parent && stmt_banned.get(parent));
    };

    const banned = win_players.concat(lose_players).filter(isBanned);

    if (banned.length > 0) {
      console.log('[report_match] Not rating banned accounts:', JSON.stringify(banned));
      win_players = win_players.filter(id => !banned.includes(id));
      lose_players = lose_players.filter(id => !banned.includes(id));

      if (win_players.length === 0 || lose_players.length === 0) {
        return res.json({ message: 'Skipping match report. A team has only banned players' });
      }
    }

    db.transaction(() => {
      // The server's event when the match started (happy hours by its own time zone) - an official server is trusted
      // with it, as with the whole report; 1 or 2 only
      const event_match_multiplier = req.body.event_match_multiplier === 2 ? 2 : 1;
      const total_rounds_played = win_score + lose_score;
      const should_count_wins = total_rounds_played >= MIN_ROUNDS_TO_COUNT_WINS;

      const allPlayers = win_players.concat(lose_players);
      const playerRatings = {};
      const default_rating = rating();
      const table_name = mmrTableOf(game_mode);
      const is_tie = isTie(table_name, win_score, lose_score);

      const stmt_insert_player = db.prepare(`INSERT OR IGNORE INTO ${table_name} (account_id, mu, sigma) VALUES (?, ?, ?)`);
      const stmt_get_player = db.prepare(`SELECT mu, sigma FROM ${table_name} WHERE account_id = ?`);
      const stmt_update_player = db.prepare(`UPDATE ${table_name} SET mu = ?, sigma = ?, mmr = ?, matches_won = matches_won + ?, matches_lost = matches_lost + ?, nickname = ? WHERE account_id = ?`);

      // An identity key account comes into being only with a match it did not abandon,
      // so that new accounts can not be made just by joining and leaving ranked matches.
      const isUnregisteredAbandoningKey = (playerId) =>
        playerId.startsWith('key_') && abandoned(player_infos[playerId] || {}) && !stmt_get_player.get(playerId);
      const unregistered = new Set(allPlayers.filter(isUnregisteredAbandoningKey));

      allPlayers.forEach(playerId => {
        if (!unregistered.has(playerId)) stmt_insert_player.run(playerId, default_rating.mu, default_rating.sigma);
      });

      allPlayers.forEach(playerId => {
        const row = stmt_get_player.get(playerId);
        playerRatings[playerId] = row ? rating({ mu: row.mu, sigma: row.sigma }) : default_rating;
      });

      // Record old MMRs for delta computation
      const oldMmrs = {};
      allPlayers.forEach(id => { oldMmrs[id] = ordinal(playerRatings[id]); });

      const original_winner_ratings = win_players.map(id => playerRatings[id]);
      const original_loser_ratings = lose_players.map(id => playerRatings[id]);

      /*
        The new ratings, as designed (lost in 3147266, restored):
        - FFA: every player ranked by place, the winner first;
        - team modes: the match is rated lose_severity(win, lose) times (1-3 by the score difference), times the event
          multiplier (2 in happy hours). Who stayed is rated without the abandoners who did not contribute; who abandoned
          is rated apart, with everyone, as a sure loss of their team. A team whose opponents abandoned wins whatever
          the score (the abandoners are always the losers in the report). Winners of a match too short to count keep
          their ratings.
      */
      const [newWinnerRatings, newLoserRatings] = (() => {
        if (table_name === 'mmr_ffa') {
          const teams = [[original_winner_ratings[0]], ...original_loser_ratings.map(r => [r])];
          const ranks = teams.map((_, place) => place + 1);
          const rated = rate(teams, { rank: ranks }).map(team => team[0]);

          return [[rated[0]], rated.slice(1)];
        }

        const make_team_ratings = (iterations, pov, count_nocontributors, force_loss_for = -1) => {
          const contributes = (id, rating_team_is_pov) => count_nocontributors || contributed_to_match(player_infos[id] || {}, rating_team_is_pov);

          const winner_indices = win_players.map((id, i) => i).filter(i => contributes(win_players[i], pov === 'winner'));
          const loser_indices = lose_players.map((id, i) => i).filter(i => contributes(lose_players[i], pov === 'loser'));

          let it_winners = winner_indices.map(i => original_winner_ratings[i]);
          let it_losers = loser_indices.map(i => original_loser_ratings[i]);

          const scores = (() => {
            if (force_loss_for === 0) return [0, 1];
            if (force_loss_for === 1) return [1, 0];
            if (losers_abandoned) return [1, 0];
            return [win_score, lose_score];
          })();

          for (let i = 0; i < iterations * event_match_multiplier; i++) {
            [it_winners, it_losers] = rate([it_winners, it_losers], { score: scores });
          }

          const final_winners = original_winner_ratings.map(() => default_rating);
          const final_losers = original_loser_ratings.map(() => default_rating);

          winner_indices.forEach((original_index, i) => { final_winners[original_index] = it_winners[i]; });
          loser_indices.forEach((original_index, i) => { final_losers[original_index] = it_losers[i]; });

          return [final_winners, final_losers];
        };

        const severity = lose_severity(win_score, lose_score);

        const present_winners = make_team_ratings(severity, 'winner', false)[0];
        const present_losers = make_team_ratings(severity, 'loser', false)[1];
        const abandoned_winners = make_team_ratings(1, 'winner', true, 0)[0];
        const abandoned_losers = make_team_ratings(1, 'loser', true, 1)[1];

        const winners = win_players.map((id, i) => {
          if (abandoned(player_infos[id] || {})) return abandoned_winners[i];
          return should_count_wins ? present_winners[i] : original_winner_ratings[i];
        });

        const losers = lose_players.map((id, i) => abandoned(player_infos[id] || {}) ? abandoned_losers[i] : present_losers[i]);

        return [winners, losers];
      })();

      // Exactly what the match changed, for revert_match.js - nothing for an account the match did not create
      const changeOf = (id, newRating, won, lost) => unregistered.has(id)
        ? { won: 0, lost: 0, mu_delta: 0, sigma_delta: 0, mmr_delta: 0 }
        : { won, lost, mu_delta: newRating.mu - playerRatings[id].mu, sigma_delta: newRating.sigma - playerRatings[id].sigma };

      // A tie counts as neither a win nor a loss, an abandon always as a loss
      const increments = (id, on_winning_team) => {
        if (is_tie) return [0, 0];
        if (abandoned(player_infos[id] || {})) return [0, 1];
        if (!should_count_wins) return [0, 0];
        return on_winning_team ? [1, 0] : [0, 1];
      };

      const winnerObjects = win_players.map((id, i) => {
        const info = player_infos[id] || {};
        const newRating = newWinnerRatings[i];
        const newMmr = ordinal(newRating);
        const [won, lost] = increments(id, true);
        stmt_update_player.run(newRating.mu, newRating.sigma, newMmr, won, lost, info.nickname, id);
        return { id, nickname: info.nickname, new_mmr: newMmr, mmr_delta: newMmr - oldMmrs[id], contributed_as_enemy: contributed_to_match(info, false), contributed_as_teammate: contributed_to_match(info, true), ...changeOf(id, newRating, won, lost) };
      });

      const loserObjects = lose_players.map((id, i) => {
        const info = player_infos[id] || {};
        const newRating = newLoserRatings[i];
        const newMmr = ordinal(newRating);
        const [won, lost] = increments(id, false);
        stmt_update_player.run(newRating.mu, newRating.sigma, newMmr, won, lost, info.nickname, id);
        return { id, nickname: info.nickname, new_mmr: newMmr, mmr_delta: newMmr - oldMmrs[id], ...changeOf(id, newRating, won, lost) };
      });

      // The last nickname and avatar of every account the match counted for: what /cert answers for a key_ account
      // and what its profile page shows. An avatar that is not a small PNG is ignored, never the report.
      const stmt_set_nickname = db.prepare('INSERT OR REPLACE INTO last_nicknames (account_id, nickname, updated_at) VALUES (?, ?, ?)');
      const now = Math.floor(Date.now() / 1000);

      allPlayers.filter(id => !unregistered.has(id)).forEach(id => {
        const info = player_infos[id] || {};

        if (typeof info.nickname === 'string' && info.nickname.length > 0) {
          stmt_set_nickname.run(id, info.nickname.slice(0, 64), now);
        }

        const avatar = parseAvatar(info.avatar);

        if (avatar) {
          setAvatar(id, avatar);
        }
      });

      db.prepare(`
        INSERT INTO matches (match_start_date, server_id, server_name, arena, game_mode, winners, losers, win_score, lose_score, event_match_multiplier, report_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(match_start_date, req.server_id, server_name, arena, game_mode, JSON.stringify(winnerObjects), JSON.stringify(loserObjects), win_score, lose_score, event_match_multiplier, report_id);

    })();

    res.json({ message: 'Match reported successfully' });
    console.log('[report_match] Match reported successfully.', JSON.stringify({ server_name, server_id: req.server_id, arena, game_mode, win_score, lose_score, win_players_count: win_players.length, lose_players_count: lose_players.length }));
  } catch (error) {
    console.error('[report_match] Error reporting match:', error.stack || error.message, JSON.stringify({ server_name, server_id: req.server_id, arena, game_mode, win_score, lose_score }));
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
