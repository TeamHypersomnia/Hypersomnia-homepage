const express = require('express');
const db = require('./db');
const router = express.Router();

// Pre-compile statements for maximum performance
const stmts = {
  updateTeamMu: db.prepare('UPDATE mmr_team SET mu = (mmr * ?) + 3 * sigma WHERE mmr < 0'),
  updateFFAMu: db.prepare('UPDATE mmr_ffa SET mu = (mmr * ?) + 3 * sigma WHERE mmr < 0'),
  updateTeamMMR: db.prepare('UPDATE mmr_team SET mmr = mu - 3 * sigma WHERE mmr < 0'),
  updateFFAMMR: db.prepare('UPDATE mmr_ffa SET mmr = mu - 3 * sigma WHERE mmr < 0')
};

const { officialServerAuth } = require('./official_servers');

// Sent only by the official server with the id 'pl' (its file in official_servers.d) - it adjusts every player
const signedByOfficialServer = officialServerAuth({ tag: 'hs-adjust-v1', onlyServerIds: ['pl'] });

/*
  An adjustment applies anew every time it is sent - so a signed one counts once and only for a few minutes:
  "issued_at" (unix seconds) in its body, its signature remembered for as long as it could still pass.
*/
const ISSUED_WINDOW_SECS = 300;
const usedSignatures = new Map();

function firstUse(signatureHex, nowSecs) {
  for (const [sig, at] of usedSignatures) {
    if (nowSecs - at > 2 * ISSUED_WINDOW_SECS) usedSignatures.delete(sig);
  }

  if (usedSignatures.has(signatureHex)) return false;

  usedSignatures.set(signatureHex, nowSecs);
  return true;
}

router.post('/', signedByOfficialServer, (req, res) => {
  const { multiplier, issued_at } = req.body;
  const nowSecs = Math.floor(Date.now() / 1000);

  if (!Number.isInteger(issued_at) || Math.abs(nowSecs - issued_at) > ISSUED_WINDOW_SECS) {
    return res.status(400).json({ error: 'issued_at missing or too far from now' });
  }

  if (!firstUse(String(req.headers['x-signature']), nowSecs)) {
    return res.status(409).json({ error: 'This adjustment was sent already' });
  }

  // Validation: ensures 0 is allowed but rejects negative numbers
  if (multiplier === undefined || typeof multiplier !== 'number' || multiplier < 0) {
    return res.status(400).json({ error: 'Valid numeric multiplier required' });
  }

  try {
    // Transaction ensures atomicity (all updates succeed or all fail)
    db.transaction((m) => {
      stmts.updateTeamMu.run(m);
      stmts.updateFFAMu.run(m);
      stmts.updateTeamMMR.run();
      stmts.updateFFAMMR.run();
    })(multiplier);

    res.json({ message: 'MMRs adjusted successfully' });
  } catch (error) {
    console.error('MMR Adjustment Error:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
