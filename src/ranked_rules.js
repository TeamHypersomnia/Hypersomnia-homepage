const db = require('./db');

/*
  What the endpoints of accounts and ranked matches agree on, in one place: which table a game mode is rated in,
  what a tie is, and which account an account is linked to (a key's or a Discord account's Steam account).
*/

const mmrTableOf = game_mode => game_mode === 'FFA Gun Game' ? 'mmr_ffa' : 'mmr_team';
/*
  Any equal score is a tie - not only 15:15: a short ranked match (a browser player) plays to 10 (9:9), and a server
  may set its own max team score. Unless the losers abandoned: then the team that stayed won, whatever the score.
*/
const isTie = (table, win_score, lose_score, losers_abandoned = false) =>
  table === 'mmr_team' && win_score === lose_score && !losers_abandoned;

const stmtParentOf = db.prepare('SELECT parent_id FROM associations WHERE child_id = ?');

function parentOf(id) {
  const row = stmtParentOf.get(id);
  return row ? row.parent_id : null;
}

module.exports = { mmrTableOf, isTie, parentOf };
