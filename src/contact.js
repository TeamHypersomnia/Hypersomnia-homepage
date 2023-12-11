const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('contact', {
    page: 'Contact',
    user: req.user
  });
})

module.exports = router;
