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

## Short match — W/L not counted

If `win_score + lose_score < 5` (fewer than 5 total rounds played):
- MMR **does change** normally
- Match **is recorded** in history
- But `matches_won` / `matches_lost` are **not incremented** for any player

---

## Tie

A tie is detected when: `game_mode != 'FFA Gun Game'` **and** `win_score == 15` **and** `lose_score == 15`.

- `rate()` is called with `{ rank: [1, 1] }` — both sides lose a small amount of MMR (uncertainty reduction without a win/loss penalty)
- W/L are still counted normally (if the match was long enough)

---

## Abandons

### What counts as an abandon
A player is considered "abandoned" if their `abandoned_at_score` field is a number `>= 0`.
The value represents the **abandoning player's team score** at the moment they left.

### Effect on the abandoning player's MMR

#### Winner-side abandoner:
- `abandoned_at_score >= 13` → **MMR changes** (rated as a winner)
- `abandoned_at_score < 13` → **MMR frozen** (too early to have contributed)
- **Always** gets `matches_lost + 1` regardless of team outcome — abandon counts as a loss

#### Loser-side abandoner:
- `abandoned_at_score >= 4` → **MMR changes** (rated as a loser)
- `abandoned_at_score < 4` → **MMR frozen** (left too early to have contributed)
- Gets `matches_lost + 1` as normal

### Effect on remaining players

An abandon does **not** change how the rating of other players is computed — `rate()` is called for full rosters, then results are selectively applied per player.

---

## Happy Hours (x2 multiplier)

Matches played on **Friday, Saturday, or Sunday between 19:00 and 21:00** local server time get `event_match_multiplier = 2`.

Supported timezones by `server_id`:

| server_id | Timezone |
|-----------|----------|
| `pl` | Europe/Warsaw |
| `de` | Europe/Berlin |
| `nl` | Europe/Amsterdam |
| `ch` | Europe/Zurich |
| `au` | Australia/Sydney |
| `ru` | Europe/Moscow |
| `us-central` | America/Chicago |

> Servers with no timezone mapping always get `multiplier = 1`.

The multiplier is stored in the `matches` table — it **does not affect the MMR calculation itself**, it is only display metadata (shown as 🔥 in match history).

---

## Player aliases (associations)

Before computing ratings, all `account_id` values are resolved through the `associations` table:
- If a `child_id` has a `parent_id` on record, the `parent_id` is used instead
- This allows merging Steam and Discord accounts into a single ranked profile

---

## FFA Gun Game

Matches with `game_mode = 'FFA Gun Game'` are written to the `mmr_ffa` table instead of `mmr_team`. Tie detection only applies to team mode.

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
    "contributed_as_enemy": true
  }
]
```

`contributed_as_enemy` is only present on loser objects — `false` means the player abandoned too early and their MMR was not updated.
