const axios = require('axios');
const { timeAgo } = require('./timeAgo');

// ─── Store ────────────────────────────────────────────────────────────────────

let latestResults = [];
let lastFetchedAt = null;
let intervalHandle = null;

// ─── Core Function ────────────────────────────────────────────────────────────

async function getLatestClosedPRs(owner, repo, limit = 5) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${limit}`;

  const response = await axios.get(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Node.js'
    }
  });

  return response.data
    .filter(pr => pr.merged_at !== null)
    .map(pr => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      timeAgo: timeAgo(pr.merged_at),
      author: pr.user.login
    }));
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

const INTERVAL_MS = 5 * 60 * 1000; //  minutes

function startPolling(owner, repo, limit = 5) {
  if (intervalHandle) {
    console.warn('Polling is already running.');
    return;
  }

  const fetch = async () => {
    try {
      latestResults = await getLatestClosedPRs(owner, repo, limit);
      lastFetchedAt = new Date();
    } catch (err) {
      console.error(`Fetch failed: ${err.message}`);
    }
  };

  fetch(); // run immediately on start
  intervalHandle = setInterval(fetch, INTERVAL_MS);
}

// ─── Results Getter ───────────────────────────────────────────────────────────

function getResults() {
  return {
    fetchedAt: lastFetchedAt,
    count: latestResults.length,
    data: latestResults
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { startPolling, getResults };