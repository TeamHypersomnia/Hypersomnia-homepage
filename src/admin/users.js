const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require('./db');

// Fetch all users sorted by most recent login
const getUsers = db.prepare('SELECT * FROM users ORDER BY lastLogin DESC');

router.get('/', (req, res) => {
  try {
    const rows = getUsers.all();
    const users = rows.map(u => ({
      ...u,
      lastLoginAgo: moment(u.lastLogin * 1000).fromNow()
    }));
    
    res.render('admin/users', {
      page: 'Users',
      user: req.user,
      users: users
    });
  } catch (error) {
    console.error('Admin Panel Error:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;