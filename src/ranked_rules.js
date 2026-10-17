const db = require('./db');

/*
  What the endpoints of accounts and ranked matches agree on, in one place: which table a game mode is rated in,
  what a tie is, and which account an account is linked to (a key's or a Discord account's Steam account).
*/

const mmrTableOf = game_mode => game_mode === 'FFA Gun Game' ? 'mmr_ffa' : 'mmr_team';
const isTie = (table, win_score, lose_score) => table === 'mmr_team' && win_score === 15 && lose_score === 15;

const stmtParentOf = db.prepare('SELECT parent_id FROM associations WHERE child_id = ?');

function parentOf(id) {
  const row = stmtParentOf.get(id);
  return row ? row.parent_id : null;
}

module.exports = { mmrTableOf, isTie, parentOf };
