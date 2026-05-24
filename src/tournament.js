const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const router = express.Router();

const STATE_DIR = path.join(os.homedir(), '.config', 'Hypersomnia', 'user');
const ONGOING_FILE = path.join(STATE_DIR, 'tournament.ongoing.json');
const COMPLETED_STATE_RE = /^tournament\.completed\..+\.state\.json$/;

function pickStateFilePath() {
  if (fs.existsSync(ONGOING_FILE)) {
    return { filePath: ONGOING_FILE, status: 'ongoing' };
  }

  let entries;
  try {
    entries = fs.readdirSync(STATE_DIR);
  } catch {
    return null;
  }

  const candidates = entries
    .filter(name => COMPLETED_STATE_RE.test(name))
    .map(name => {
      const full = path.join(STATE_DIR, name);
      try {
        return { full, mtime: fs.statSync(full).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);

  if (!candidates.length) {
    return null;
  }

  return { filePath: candidates[0].full, status: 'completed' };
}

function loadState() {
  const picked = pickStateFilePath();
  if (!picked) return null;

  let raw;
  try {
    raw = fs.readFileSync(picked.filePath, 'utf8');
  } catch {
    return null;
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!json || typeof json !== 'object' || !Array.isArray(json.teams)) {
    return null;
  }

  return { state: json, source: picked };
}

function teamLabel(team) {
  return (team.player_ids || []).join(', ');
}

function arrayEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function findTeamIndexByRoster(teams, roster) {
  for (let i = 0; i < teams.length; i++) {
    if (arrayEqual(teams[i].player_ids || [], roster || [])) return i;
  }
  return -1;
}

/*
  Reconstructs a per-stage list of {matches, byes} from the state.

  Completed stages come from match_history (player_ids only, no team
  indices -- so we resolve them by matching rosters). The currently
  running stage comes from current_stage_matches when present.
*/
function buildStages(state) {
  const teams = state.teams || [];
  const history = state.match_history || [];
  const currentMatches = state.current_stage_matches || [];

  const stageIndex = state.stage_index || 0;
  const stages = [];

  const eliminatedBeforeStage = new Set();

  const completedStageCount = stageIndex;

  for (let s = 0; s < completedStageCount; s++) {
    const entries = history.filter(h => (h.played_in_stage || 0) === s);
    const matches = [];
    const playedTeamIndices = new Set();

    for (const h of entries) {
      const winnerIdx = findTeamIndexByRoster(teams, h.winner_player_ids);
      const loserIdx = findTeamIndexByRoster(teams, h.loser_player_ids);

      matches.push({
        teamA: winnerIdx,
        teamB: loserIdx,
        resolved: true,
        winner: winnerIdx
      });

      if (winnerIdx >= 0) playedTeamIndices.add(winnerIdx);
      if (loserIdx >= 0) playedTeamIndices.add(loserIdx);
    }

    const byes = [];
    for (let i = 0; i < teams.length; i++) {
      if (eliminatedBeforeStage.has(i)) continue;
      if (playedTeamIndices.has(i)) continue;
      byes.push(i);
    }

    stages.push({ index: s, matches, byes });

    for (const m of matches) {
      if (m.teamB >= 0) eliminatedBeforeStage.add(m.teamB);
    }
  }

  const finished = teams.filter(t => !t.eliminated).length <= 1;

  if (currentMatches.length > 0 && !finished) {
    const matches = [];
    const playedTeamIndices = new Set();

    for (const m of currentMatches) {
      const teamA = m.team_a_index;
      const teamB = m.team_b_index;
      let winner = -1;
      if (m.resolved) winner = m.winner_team_index;

      matches.push({
        teamA,
        teamB,
        resolved: !!m.resolved,
        winner
      });

      playedTeamIndices.add(teamA);
      playedTeamIndices.add(teamB);
    }

    const byes = [];
    for (let i = 0; i < teams.length; i++) {
      if (eliminatedBeforeStage.has(i)) continue;
      if (playedTeamIndices.has(i)) continue;
      byes.push(i);
    }

    stages.push({ index: stageIndex, matches, byes });
  }

  let winnerIndex = -1;
  if (finished) {
    for (let i = 0; i < teams.length; i++) {
      if (!teams[i].eliminated) {
        winnerIndex = i;
        break;
      }
    }
  }

  return { stages, winnerIndex, finished };
}

function buildView() {
  const loaded = loadState();
  if (!loaded) return null;

  const { state, source } = loaded;
  const teams = (state.teams || []).map(t => ({
    player_ids: t.player_ids || [],
    eliminated: !!t.eliminated,
    label: teamLabel(t)
  }));

  const { stages, winnerIndex, finished } = buildStages(state);

  return {
    teams,
    stages,
    winnerIndex,
    finished,
    sourceStatus: source.status,
    sourceFile: path.basename(source.filePath)
  };
}

router.get('/', (req, res) => {
  const view = buildView();

  if (req.query?.format === 'json') {
    return res.json(view || { error: 'no_state' });
  }

  if (req.query?.fragment === '1') {
    return res.render('tournament_fragment', { view });
  }

  res.render('tournament', {
    page: 'Tournament',
    user: req.user,
    view
  });
});

module.exports = router;
