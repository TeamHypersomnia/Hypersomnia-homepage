const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
  res.render('profile', {
    page: 'Profile',
    user: req.user
  });
});

module.exports = router;
