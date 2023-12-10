const axios = require('axios');
const moment = require('moment');
let commits = [];

function cutTitle(title, maxLength) {
  return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
}

module.exports = {
  init: function () {
    function fetchCommits(callback) {
      axios.get('https://api.github.com/repos/TeamHypersomnia/Hypersomnia/commits')
        .then(response => {
          commits = response.data.slice(0, 10).map(commit => ({
            sha: commit.sha,
            date: commit.commit.author.date,
            msg: cutTitle(commit.commit.message, 35),
          }));
        })
        .catch(error => {
          console.error(`Error fetching commits: ${error.message}`);
        });
    }
    fetchCommits();
    setInterval(fetchCommits, 600000); // 10 minutes
  },

  getCommits: function () {
    const formattedData = commits.map(v => {
      return {
        ...v,
        date: moment.utc(v.date).fromNow()
      };
    });
    return formattedData;
  }
};
