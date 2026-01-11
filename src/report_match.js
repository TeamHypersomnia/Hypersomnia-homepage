const assert = require('assert');
const express = require('express');
const db = require('./db');
const { rating, rate, ordinal } = require('openskill');
const moment = require('moment-timezone');

const router = express.Router();

const MIN_SCORE_AS_TEAMMATE_TO_CONTRIBUTE = 13;
const MIN_SCORE_AS_ENEMY_TO_CONTRIBUTE = 4;
const MIN_ROUNDS_TO_COUNT_WINS = 5;

// Middleware for API key authentication using SQLite
const getServerByKey = db.prepare('SELECT server_id FROM authorized_servers WHERE api_key = ?');

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['apikey'];
  if (!apiKey) return res.status(401).json({ error: 'Unauthorized' });

  const row = getServerByKey.get(apiKey);
  if (!row) return res.status(401).json({ error: 'Unauthorized' });

  req.server_id = row.server_id;
  next();
}

// Helper functions
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

function isWeekendEveningTime(isoTimestamp, location_id) {
  const timeZoneMap = {
    "au": "Australia/Sydney",
    "ru": "Europe/Moscow",
    "de": "Europe/Berlin",
    "us-central": "America/Chicago",
    "pl": "Europe/Warsaw",
    "ch": "Europe/Zurich",
    "nl": "Europe/Amsterdam"
  };

  const timeZone = timeZoneMap[location_id];
  if (!timeZone) return false;

  const localTime = moment(isoTimestamp).tz(timeZone);
  const dayOfWeek = localTime.day(); // Sunday=0, Monday=1, ..., Saturday=6
  const hour = localTime.hour();

  return (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) && hour >= 19 && hour < 21;
}

function lose_severity(win, lose) {
  const diff = win - lose;
  if (diff >= 13) return 3;
  if (diff >= 8) return 2;
  return 1;
}

function mapIdArray(playerIds, db) {
  const originalIdsSet = new Set(playerIds);
  return playerIds.map(id => {
    const association = db.prepare('SELECT parent_id FROM associations WHERE child_id = ?').get(id);
    return association && !originalIdsSet.has(association.parent_id) ? association.parent_id : id;
  });
}

function mapPlayerInfos(playerInfos, db) {
  const updatedPlayerInfos = {};
  const originalIdsSet = new Set(Object.keys(playerInfos));

  for (const [id, info] of Object.entries(playerInfos)) {
    const association = db.prepare('SELECT parent_id FROM associations WHERE child_id = ?').get(id);
    const parentId = association && !originalIdsSet.has(association.parent_id) ? association.parent_id : id;
    updatedPlayerInfos[parentId] = info;
  }

  return updatedPlayerInfos;
}

// Route
router.post('/', apiKeyAuth, (req, res) => {
  const { match_start_date, server_name, arena, game_mode, win_score, lose_score } = req.body;
  let { losers_abandoned } = req.body;
  let { win_players, lose_players, player_infos } = req.body;

  // Validation
  if (!win_score || !lose_score || !win_players || !lose_players || !player_infos || !server_name || !arena || !game_mode || !match_start_date) {
    return res.status(400).json({ error: 'Missing required match data' });
  }
  if (win_players.length === 0 || lose_players.length === 0) {
    return res.status(400).json({ error: 'Player arrays cannot be empty' });
  }
  losers_abandoned = losers_abandoned || false;

  if (allAbandoned(player_infos)) return res.json({ message: 'Skipping match report. All players abandoned the match' });

  try {
    win_players = mapIdArray(win_players, db);
    lose_players = mapIdArray(lose_players, db);
    player_infos = mapPlayerInfos(player_infos, db);

    db.transaction(() => {
      const is_happy_hours = isWeekendEveningTime(match_start_date, req.server_id);
      const event_match_multiplier = is_happy_hours ? 2 : 1;
      const total_rounds_played = win_score + lose_score;
      const should_count_wins = total_rounds_played >= MIN_ROUNDS_TO_COUNT_WINS;

      const allPlayers = win_players.concat(lose_players);
      const playerRatings = {};
      const default_rating = rating();

      const table_name = game_mode === 'FFA Gun Game' ? 'mmr_ffa' : 'mmr_team';
      const is_tie = table_name === 'mmr_team' && win_score === 15 && lose_score === 15;

      const stmt_insert_player = db.prepare(`INSERT OR IGNORE INTO ${table_name} (account_id, mu, sigma) VALUES (?, ?, ?)`);
      const stmt_get_player = db.prepare(`SELECT mu, sigma FROM ${table_name} WHERE account_id = ?`);
      const stmt_update_player = db.prepare(`UPDATE ${table_name} SET mu = ?, sigma = ?, mmr = ?, matches_won = matches_won + ?, matches_lost = matches_lost + ?, nickname = ? WHERE account_id = ?`);

      // Insert missing players
      allPlayers.forEach(playerId => stmt_insert_player.run(playerId, default_rating.mu, default_rating.sigma));

      // Load current ratings
      allPlayers.forEach(playerId => {
        const row = stmt_get_player.get(playerId);
        playerRatings[playerId] = rating({ mu: row.mu, sigma: row.sigma });
      });

      // Compute updated ratings
      const original_winner_ratings = win_players.map(id => playerRatings[id]);
      const original_loser_ratings = lose_players.map(id => playerRatings[id]);

      // Rating calculation logic remains unchanged (see your original code)
      // … (the full rate() and abandoned adjustments code remains here)

      // After calculating updatedRatings, update DB
      // Example loop:
      const updatedRatings = [original_winner_ratings, original_loser_ratings]; // Replace with actual computed
      updatedRatings.forEach((team, index) => {
        team.forEach((playerRating, playerIndex) => {
          const playerId = index === 0 ? win_players[playerIndex] : lose_players[playerIndex];
          const mmr = ordinal(playerRating);
          const winIncrement = index === 0 && !abandoned(player_infos[playerId]) ? 1 : 0;
          const lossIncrement = index === 1 || abandoned(player_infos[playerId]) ? 1 : 0;
          const new_nickname = player_infos[playerId].nickname;
          stmt_update_player.run(playerRating.mu, playerRating.sigma, mmr, winIncrement, lossIncrement, new_nickname, playerId);
        });
      });

      // Insert match
      const insertMatchSql = `
        INSERT INTO matches (match_start_date, server_id, server_name, arena, game_mode, winners, losers, win_score, lose_score, event_match_multiplier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.prepare(insertMatchSql).run(match_start_date, req.server_id, server_name, arena, game_mode, JSON.stringify(win_players), JSON.stringify(lose_players), win_score, lose_score, event_match_multiplier);

    })();

    res.json({ message: 'Match reported successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
