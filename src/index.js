const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment');
let commits = [];

function cutTitle(title, maxLength) {
  return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
}

function fetchCommits() {
  axios.get('https://api.github.com/repos/TeamHypersomnia/Hypersomnia/commits')
    .then(response => {
      commits = response.data.slice(0, 10).map(commit => ({
        sha: commit.sha,
        date: commit.commit.author.date,
        msg: cutTitle(commit.commit.message, 35),
      }));
    })
    .catch(error => {
      console.error(error.message);
    });
}
fetchCommits();
setInterval(fetchCommits, 600000); // 10 min

router.get('/', (req, res) => {
  const obj = commits.map(v => {
    return {
      ...v,
      date: moment.utc(v.date).fromNow()
    };
  });
  res.render('index', {
    page: 'Index',
    user: req.user,
    commits: obj
  });
})

module.exports = router;
