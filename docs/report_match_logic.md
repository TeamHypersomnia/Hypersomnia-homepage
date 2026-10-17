# Match Reporting Logic

## Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `MIN_ROUNDS_TO_COUNT_WINS` | 5 | Minimum total rounds played for a match to count toward wins, if you win it |
| `MIN_SCORE_AS_TEAMMATE_TO_CONTRIBUTE` | 13 | A winner-side abandoner must have reached this score to affect MMR |
| `MIN_SCORE_AS_ENEMY_TO_CONTRIBUTE` | 4 | A loser-side abandoner must have reached this score to affect MMR |

---

## When a match is rejected or skipped

| Condition | Result |
|-----------|--------|
| Missing required field (`win_score`, `lose_score`, `arena`, etc.) | `400` — match not recorded |
| `win_players` or `lose_players` is an empty array | `400` — match not recorded |
| **All** players have `abandoned_at_score` set | Skipped silently with `200` — nobody finished the match |

---

## How the ratings change

Team modes (`mmr_team`) - openskill `rate()` with the scores, applied:

- **Score difference:** the match is rated `lose_severity(win, lose)` times in a row: 1 time for a difference under 8,
  2 times from 8, 3 times from 13 - a crushing win moves the ratings more.
- **Happy hours:** all of that once more (`event_match_multiplier = 2`, see below).
- **Who stayed** is rated without the abandoners who did not contribute (below), with the real scores - or `1:0` when
  the losers abandoned (the team left on the server wins whatever the score was, even 1:5).
- **Who abandoned** is rated apart, once, with everyone, as a sure loss of their team (`0:1` for a winner-side abandoner,
  `1:0` against a loser-side one).

FFA Gun Game (`mmr_ffa`) - every player ranked by place in one `rate()`: the winner 1st, the others in the report's order.
No score difference, no multiplier.

---

## Short match — wins not counted

If `win_score + lose_score < 5` (fewer than 5 total rounds played):
- the winners **keep their ratings**, the losers are rated as usual
- Match **is recorded** in history
- `matches_won` and `matches_lost` are **not incremented** — **but abandoners always get a loss** regardless of match length

---

## Tie

A tie is detected when: `game_mode != 'FFA Gun Game'` **and** `win_score == 15` **and** `lose_score == 15`.

- rated with the equal scores (15:15) - both sides move by the uncertainty only
- neither a win nor a loss is counted for anyone, abandoners included

---

## Abandons

### What counts as an abandon
A player is considered "abandoned" if their `abandoned_at_score` field is a number `>= 0`.
The value represents the **abandoning player's team score** at the moment they left.

### Who contributed
- a winner-side abandoner contributed if `abandoned_at_score >= 13`, a loser-side one if `>= 4`
  (as the enemy of the other team)
- the ratings of the players who stayed are computed without the abandoners who did not contribute

### The abandoner's own rating and counts
- rated as a sure loss (see "How the ratings change")
- **always** gets `matches_lost + 1`, regardless of the outcome or the match length (except a tie)

---

## Happy Hours (x2 multiplier)

The game server decides: a ranked match started on **Friday, Saturday or Sunday between 19:00 and 21:00** by the
server's time zone (its system's, or `time_zone` in its config) is reported with `event_match_multiplier = 2`, any
other with 1. The site takes 1 or 2 only.

The multiplier **doubles the rating of who stayed** (the match is rated twice as many times) and is stored in the
`matches` table (shown as 🔥 in match history).

---

## Player aliases (associations)

Before computing ratings, all `account_id` values are resolved through the `associations` table:
- If a `child_id` has a `parent_id` on record, the `parent_id` is used instead
- This allows merging Steam and Discord accounts into a single ranked profile
- Except linked keys (`key_...`): a key reported as itself (the player had no Steam cert) keeps its own row, hidden from the leaderboards while it is linked

---

## Nicknames and avatars

Each entry of `player_infos` may carry `"avatar": "<base64 PNG>"` next to `"nickname"`. The last nickname and avatar
of every account the match counted for are kept (`last_nicknames`, `avatars`) - shown on profile pages, served at
`/avatar/<account_id>.png` and sent with key certs by `/cert`. An avatar that is not a PNG of at most 80x80 pixels and
64 KB is ignored, never the report.

---

## Data stored per match

The `winners` and `losers` columns in the `matches` table are JSON arrays:

```json
[
  {
    "id": "steam_xxx",
    "nickname": "player",
    "new_mmr": 24.5,
    "mmr_delta": 3.2,
    "won": 1,
    "lost": 0,
    "mu_delta": 1.1,
    "sigma_delta": -0.2,
    "contributed_as_enemy": true,
    "contributed_as_teammate": true
  }
]
```

- `won`, `lost`, `mu_delta`, `sigma_delta`: exactly what the match changed - `revert_match.js` takes them back.
- `contributed_as_enemy` / `contributed_as_teammate`: on winner objects only - whether a winner-side abandoner counted
  (a player's page lists the winners who contributed as the opponents of a loser).
