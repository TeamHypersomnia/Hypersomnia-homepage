const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    page: false,
    user: req.user
  });
})

module.exports = router;
