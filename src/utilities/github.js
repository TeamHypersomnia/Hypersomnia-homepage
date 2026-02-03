const axios = require('axios');

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
      mergedAt: pr.merged_at,
      author: pr.user.login
    }));
}

module.exports = { getLatestClosedPRs };