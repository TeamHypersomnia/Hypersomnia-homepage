const assert = require('assert');

const express = require('express');
const Database = require('better-sqlite3');
const { rating, rate, ordinal } = require('openskill');
const { lose_severity, severityToString } = require('./lose_severity');

const router = express.Router();
const dbPath = process.env.DB_PATH;

const ABANDONED_SCORE_CONTRIBUTION_CUTOFF = 13;
const MIN_ROUNDS_TO_COUNT_WINS = 5;

const abandoned = ((player) => {
  return typeof player.abandoned_at_score === 'number' && player.abandoned_at_score >= 0;
});

const contributed_to_match = ((player) => {
  if (abandoned(player)) {
    return player.abandoned_at_score >= ABANDONED_SCORE_CONTRIBUTION_CUTOFF;
  }

  return true;
});

// Middleware for API key authentication
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers["apikey"];
  if (apiKey && apiKey === process.env.REPORT_MATCH_APIKEY) {
    return next();
  } else {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

router.post('/', apiKeyAuth, (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { match_start_date, server_name, arena, game_mode, win_score, lose_score, win_players, lose_players, player_infos } = req.body;

  // Validate input
  if (typeof win_score === 'undefined') {
    return res.status(400).json({ error: 'Missing win_score' });
  }

  if (typeof lose_score === 'undefined') {
    return res.status(400).json({ error: 'Missing lose_score' });
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

  try {
    const db = new Database(dbPath);

    db.transaction(() => {
      // This mult change depending on various events.
      // For now only integer values are supported even tho the database can hold floats.
      const event_match_multiplier = 1; 

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
          const won_by_abandon = win_score != 16;

          const make_team_ratings = ((iterations, count_nocontrib_winners, count_nocontrib_losers, force_loss_for = -1) => {
            const purge_nocontrib_winners = !count_nocontrib_winners; 
            const purge_nocontrib_losers = !count_nocontrib_losers; 

            let it_winners = original_winner_ratings;
            let it_losers = original_loser_ratings;

            // Arrays to track the indices of abandoned players
            let contrib_winners_indices = [];
            let contrib_losers_indices = [];

            const contributed = ((playerId) => {
              return contributed_to_match(player_infos[playerId]);
            });

            if (purge_nocontrib_winners) {
              it_winners = [];

              original_winner_ratings.forEach((player, index) => {
                if (contributed(win_players[index])) {
                  contrib_winners_indices.push(index);
                  it_winners.push(player);
                }
              });
            }

            if (purge_nocontrib_losers) {
              it_losers = [];

              original_loser_ratings.forEach((player, index) => {
                if (contributed(lose_players[index])) {
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
                   * In the input, the abandoning team always properly marked as lose_players and lose_score.
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

          const ratings_for_present_winners = make_team_ratings(severity, false, true)[0];
          const ratings_for_present_losers = make_team_ratings(severity, true, false)[1];

          const ratings_for_abandons_in_winners = make_team_ratings(3, true, true, 0)[0];
          const ratings_for_abandons_in_losers = make_team_ratings(3, true, true, 1)[1];

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
        const contributed_to_win = contributed_to_match(player_infos[player_id]);

        winners.push({ 
          nickname: player_infos[player_id].nickname,
          id: player_id,
          new_mmr: ordinal(rating),
          mmr_delta: ordinal(rating) - ordinal(original_winner_ratings[index]),
          ...(abandoned_at >= 0 && { abandoned_at_score: abandoned_at }),
          contributed: contributed_to_win
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
        INSERT INTO matches (match_start_date, server_name, arena, game_mode, winners, losers, win_score, lose_score, event_match_multiplier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.prepare(insertMatchSql).run(match_start_date, server_name, arena, game_mode, JSON.stringify(winners), JSON.stringify(losers), win_score, lose_score, event_match_multiplier);
    })(); // Execute the transaction

    res.json({ message: 'Match reported successfully' });
  }
  catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
