const assert = require('assert');

const fs = require('fs');
const express = require('express');
const Database = require('better-sqlite3');
const { rating, rate, ordinal } = require('openskill');
const { lose_severity, severityToString } = require('./lose_severity');
const moment = require('moment-timezone');

function isWeekendEveningTime(isoTimestamp, location_id) {
  const timeZoneMap = {
    "au": "Australia/Sydney", // Sydney, Australia - GMT+10 (AEST, GMT+11 when observing AEDT)
    "ru": "Europe/Moscow", // St. Petersburg, Russia - GMT+3 (MSK, no daylight saving time)
    "de": "Europe/Berlin", // Berlin, Germany - GMT+1 (CET, GMT+2 when observing CEST)
    "us-central": "America/Chicago", // Central US - GMT-6 (CST, GMT-5 when observing CDT)
    "pl": "Europe/Warsaw", // Warsaw, Poland - GMT+1 (CET, GMT+2 when observing CEST)
    "ch": "Europe/Zurich",
    "nl": "Europe/Amsterdam" // Eygelshoven, Netherlands - GMT+1 (CET, GMT+2 when observing CEST)
  };

  // Get the corresponding time zone for the location_id
  const timeZone = timeZoneMap[location_id];

  if (!timeZone) {
    return false;
  }

  // Convert the ISO8601 timestamp to the local time of the given location
  const localTime = moment(isoTimestamp).tz(timeZone);

  // Extract the day of the week and the hour
  const dayOfWeek = localTime.day(); // Sunday = 0, Monday = 1, ..., Saturday = 6
  const hour = localTime.hour();

  // Check if it's Friday, Saturday, or Sunday
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

  // Check if the time is between 19:00-21:00
  const isInTimeRange = hour >= 19 && hour < 21;

  // Return true if both conditions are met, false otherwise
  return isWeekend && isInTimeRange;
}

const router = express.Router();
const dbPath = process.env.DB_PATH;

const MIN_SCORE_AS_TEAMMATE_TO_CONRIBUTE = 13;
const MIN_SCORE_AS_ENEMY_TO_CONTRIBUTE = 4;

const MIN_ROUNDS_TO_COUNT_WINS = 5;

const authorizedServersPath = `${__dirname}/../private/authorized_ranked_servers.json`;
const authorizedServersData = fs.readFileSync(authorizedServersPath, {
  encoding: 'utf8',
  flag: 'r'
});

const authorizedServers = JSON.parse(authorizedServersData);

const abandoned = ((player) => {
  return typeof player.abandoned_at_score === 'number' && player.abandoned_at_score >= 0;
});

function allAbandoned(playerInfos) {
    return Object.values(playerInfos).every(abandoned);
}

const contributed_to_match = ((player, is_teammate) => {
  if (abandoned(player)) {
    if (is_teammate) {
      return player.abandoned_at_score >= MIN_SCORE_AS_TEAMMATE_TO_CONRIBUTE;
    }
    else {
      return player.abandoned_at_score >= MIN_SCORE_AS_ENEMY_TO_CONTRIBUTE;
    }
  }

  return true;
});

// Middleware for API key authentication
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['apikey'];

  if (apiKey in authorizedServers) {
    // Set server ID in the request for later use
    req.server_id = authorizedServers[apiKey].id;
    next();
  } else {
    res.status(401).send({ error: 'Unauthorized' });
  }
}

function mapIdArray(playerIds, db) {
  const originalIdsSet = new Set(playerIds);
  return playerIds.map(id => {
    const association = db.prepare('SELECT parent_id FROM associations WHERE child_id = ?').get(id);
    if (association && !originalIdsSet.has(association.parent_id)) {
      return association.parent_id;
    }
    return id;
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

router.post('/', apiKeyAuth, (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { match_start_date, server_name, arena, game_mode, win_score, lose_score } = req.body;
  let { losers_abandoned } = req.body;
  let { win_players, lose_players, player_infos } = req.body;

  // Validate input
  if (typeof win_score === 'undefined') {
    return res.status(400).json({ error: 'Missing win_score' });
  }

  if (typeof lose_score === 'undefined') {
    return res.status(400).json({ error: 'Missing lose_score' });
  }

  if (typeof losers_abandoned === 'undefined') {
    losers_abandoned = false;
  }

  if (!win_players) {
    return res.status(400).json({ error: 'Missing win_players' });
  }

  if (!lose_players) {
    return res.status(400).json({ error: 'Missing lose_players' });
  }

  if (!player_infos) {
    return res.status(400).json({ error: 'Missing player_infos' });
  }

  if (!server_name) {
    return res.status(400).json({ error: 'Missing server_name' });
  }

  if (!arena) {
    return res.status(400).json({ error: 'Missing arena' });
  }

  if (!game_mode) {
    return res.status(400).json({ error: 'Missing game_mode' });
  }

  if (!match_start_date) {
    return res.status(400).json({ error: 'Missing match_start_date' });
  }

  if (win_players.length == 0 || lose_players.length == 0) {
    return res.status(400).json({ error: 'Invalid input format: lose/win players array is empty' });
  }

  if (allAbandoned(player_infos)) {
    return res.json({ message: 'Skipping match report. All players abandoned the match' });
  }

  try {
    const db = new Database(dbPath);

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
      const table_name = (() => {
        if (game_mode === 'Bomb Defusal') {
          return 'mmr_team';
        }

        if (game_mode === 'FFA Gun Game') {
          return 'mmr_ffa';
        }

        return 'mmr_team';
      })();

      const is_tie = table_name === 'mmr_team' && win_score === 15 && lose_score === 15;

      const stmt_insert_player = db.prepare(`INSERT OR IGNORE INTO ${table_name} (account_id, mu, sigma) VALUES (?, ?, ?)`);
      const stmt_get_player = db.prepare(`SELECT mu, sigma FROM ${table_name} WHERE account_id = ?`);
      const stmt_update_player = db.prepare(`UPDATE ${table_name} SET mu = ?, sigma = ?, mmr = ?, matches_won = matches_won + ?, matches_lost = matches_lost + ?, nickname = ? WHERE account_id = ?`);

      // Insert player entries if they do not exist
      allPlayers.forEach(playerId => {
        stmt_insert_player.run(playerId, default_rating.mu, default_rating.sigma);
      });

      // Read current ratings from the database
      allPlayers.forEach(playerId => {
        const row = stmt_get_player.get(playerId);
        playerRatings[playerId] = rating({ mu: row.mu, sigma: row.sigma });
      });

      // Calculate new ratings
      const original_winner_ratings = win_players.map(playerId => playerRatings[playerId]);
      const original_loser_ratings = lose_players.map(playerId => playerRatings[playerId]);

      const updatedRatings = (() => {
        if (table_name === 'mmr_ffa') {
          // In case of ffa,
          // winners array will have one element and losers will have the rest of the players

          // Create an array of ranks, starting from 2 up to the number of losers
          const ranks = original_loser_ratings.map((_, index) => index + 2);

          // Create an array of ranks, starting from 1 up to the number of players
          ranks.unshift(1);

          // Split original_winner_ratings into individual teams (one player per team)
          const individualTeams = original_loser_ratings.map(player => [player]);
          individualTeams.unshift([original_winner_ratings[0]]);

          // Call the rate function with individual teams and ranks
          const new_ratings = rate(individualTeams, { rank: ranks });

          // Extract the ratings from the nested arrays
          const extractedRatings = new_ratings.map(ratingArray => ratingArray[0]);

          // Reconstruct the ratings into the desired format
          const winnerRating = [extractedRatings[0]];
          const loserRatings = extractedRatings.slice(1);

          return [winnerRating, loserRatings];
        }
        else {
          const won_by_abandon = losers_abandoned;

          const make_team_ratings = ((iterations, pov, count_nocontrib_winners, count_nocontrib_losers, force_loss_for = -1) => {
            const purge_nocontrib_winners = !count_nocontrib_winners; 
            const purge_nocontrib_losers = !count_nocontrib_losers; 

            let it_winners = original_winner_ratings;
            let it_losers = original_loser_ratings;

            // Arrays to track the indices of abandoned players
            let contrib_winners_indices = [];
            let contrib_losers_indices = [];

            const contributed = ((playerId, is_teammate) => {
              return contributed_to_match(player_infos[playerId], is_teammate);
            });

            if (purge_nocontrib_winners) {
              it_winners = [];

              original_winner_ratings.forEach((player, index) => {
                if (contributed(win_players[index], pov === "winner")) {
                  contrib_winners_indices.push(index);
                  it_winners.push(player);
                }
              });
            }

            if (purge_nocontrib_losers) {
              it_losers = [];

              original_loser_ratings.forEach((player, index) => {
                if (contributed(lose_players[index], pov === "loser")) {
                  contrib_losers_indices.push(index);
                  it_losers.push(player);
                }
              });
            }

            for (let i = 0; i < iterations * event_match_multiplier; i++) {
              const teams = [it_winners, it_losers];
              let scores = [win_score, lose_score];

              if (force_loss_for === 0) {
                scores = [0, 1];
              }
              else if (force_loss_for === 1) {
                scores = [1, 0];
              }
              else {
                if (won_by_abandon) {
                  /*
                   * Force a win regardless of if the remaining team 
                   * was currently losing 1:5, or tying 7:7.
                   * In the input, the abandoning team is always properly marked as lose_players and lose_score.
                   *
                   * Therefore, the scores might seem "inverted" like 1:5,
                   * but still if the team with 5 points abandoned,
                   * the match was won by the team with 1 point.
                   * Same applies for a temporary tie like 7:7.
                  */
                  scores = [1, 0];
                }
              }

              const next_ratings = rate(teams, { score: scores });

              it_winners = next_ratings[0];
              it_losers = next_ratings[1];
            }

            if (purge_nocontrib_winners) {
              final_winners = []

              for (let i = 0; i < original_winner_ratings.length; i++) {
                final_winners.push(default_rating);
              }

              assert.strictEqual(it_winners.length, contrib_winners_indices.length);

              for (let i = 0; i < contrib_winners_indices.length; i++) {
                final_winners[contrib_winners_indices[i]] = it_winners[i];
              }

              it_winners = final_winners;
            }

            if (purge_nocontrib_losers) {
              final_losers = []

              for (let i = 0; i < original_loser_ratings.length; i++) {
                final_losers.push(default_rating);
              }
              
              assert.strictEqual(it_losers.length, contrib_losers_indices.length);

              for (let i = 0; i < contrib_losers_indices.length; i++) {
                final_losers[contrib_losers_indices[i]] = it_losers[i];
              }

              it_losers = final_losers;
            }

            return [it_winners, it_losers];
          });

          const severity = lose_severity(win_score, lose_score);

          const ratings_for_present_winners = make_team_ratings(severity, "winner", false, false)[0];
          const ratings_for_present_losers  = make_team_ratings(severity, "loser" , false, false)[1];

          const ratings_for_abandons_in_winners = make_team_ratings(2, "winner", true, true, 0)[0];
          const ratings_for_abandons_in_losers  = make_team_ratings(2, "loser" , true, true, 1)[1];

          const updated_winners = [];
          const updated_losers = [];

          original_winner_ratings.forEach((rating, playerIndex) => {
            const playerId = win_players[playerIndex];

            if (abandoned(player_infos[playerId])) {
              updated_winners.push(ratings_for_abandons_in_winners[playerIndex]);
            }
            else {
              if (should_count_wins) {
                updated_winners.push(ratings_for_present_winners[playerIndex]);
              }
              else {
                updated_winners.push(rating);
              }
            }
          });

          original_loser_ratings.forEach((rating, playerIndex) => {
            const playerId = lose_players[playerIndex];

            if (abandoned(player_infos[playerId])) {
              updated_losers.push(ratings_for_abandons_in_losers[playerIndex]);
            }
            else {
              updated_losers.push(ratings_for_present_losers[playerIndex]);
            }
          });

          return [updated_winners, updated_losers];
        }
      })();

      // Update players in the database with new ratings
      updatedRatings.forEach((team, index) => {
        team.forEach((playerRating, playerIndex) => {
          const playerId = index === 0 ? win_players[playerIndex] : lose_players[playerIndex];
          let winIncrement = index === 0 ? 1 : 0;
          let lossIncrement = index === 1 ? 1 : 0;

          if (abandoned(player_infos[playerId])) {
            winIncrement = 0;
            lossIncrement = 1;
          }

          if (is_tie) {
            winIncrement = 0;
            lossIncrement = 0;
          }

          const mmr = ordinal(playerRating);
          const new_nickname = player_infos[playerId].nickname;

          stmt_update_player.run(playerRating.mu, playerRating.sigma, mmr, winIncrement, lossIncrement, new_nickname, playerId);
        });
      });

      const winners = [];
      const losers = [];

      updatedRatings[0].forEach((rating, index) => {
        const player_id = win_players[index];
        const abandoned_at = player_infos[player_id].abandoned_at_score;
        const contributed_as_teammate = contributed_to_match(player_infos[player_id], true);
        const contributed_as_enemy    = contributed_to_match(player_infos[player_id], false);

        winners.push({ 
          nickname: player_infos[player_id].nickname,
          id: player_id,
          new_mmr: ordinal(rating),
          mmr_delta: ordinal(rating) - ordinal(original_winner_ratings[index]),
          ...(abandoned_at >= 0 && { abandoned_at_score: abandoned_at }),
          contributed_as_enemy: contributed_as_enemy,
          contributed_as_teammate: contributed_as_teammate
        });
      });

      updatedRatings[1].forEach((rating, index) => {
        const player_id = lose_players[index];
        const abandoned_at = player_infos[player_id].abandoned_at_score;

        losers.push({ 
          nickname: player_infos[player_id].nickname,
          id: player_id,
          new_mmr: ordinal(rating),
          mmr_delta: ordinal(rating) - ordinal(original_loser_ratings[index]),
          ...(abandoned_at >= 0 && { abandoned_at_score: abandoned_at })
        });
      });

      const insertMatchSql = `
        INSERT INTO matches (match_start_date, server_id, server_name, arena, game_mode, winners, losers, win_score, lose_score, event_match_multiplier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.prepare(insertMatchSql).run(match_start_date, req.server_id, server_name, arena, game_mode, JSON.stringify(winners), JSON.stringify(losers), win_score, lose_score, event_match_multiplier);
    })(); // Execute the transaction

    res.json({ message: 'Match reported successfully' });
  }
  catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
