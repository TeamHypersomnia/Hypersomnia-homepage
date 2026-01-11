const express = require('express');
const router = express.Router();
const db = require('../db');

const getUsersStmt = db.prepare(`
  SELECT *
  FROM users
  ORDER BY last_login DESC
`);

router.get('/', (req, res) => {
  try {
    const users = getUsersStmt.all();

    res.render('admin/users', {
      page: 'Users',
      user: req.user,
      users
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
