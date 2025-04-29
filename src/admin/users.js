const express = require('express');
const router = express.Router();
const moment = require('moment');
const fs = require('fs');
const path = './private/users.json';

function loadUsers() {
  try {
    const d = fs.readFileSync(path, 'utf8');
    const obj = JSON.parse(d);
    return obj;
  } catch (error) {
    console.error(error.message);
    return {};
  }
}

router.get('/', (req, res) => {
  const updatedUsers = Object.fromEntries(
    Object.entries(loadUsers())
      .sort(([, a], [, b]) => b.lastLogin - a.lastLogin)
      .map(([k, v]) => [
        k,
        {
          ...v,
          lastLoginAgo: moment(v.lastLogin * 1000).fromNow()
        }
      ])
  );  
  res.render('admin/users', {
    page: 'Users',
    user: req.user,
    users: updatedUsers
  });
});

module.exports = router;
