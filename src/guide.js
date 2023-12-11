const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('guide', {
    page: 'Guide',
    user: req.user
  });
})

module.exports = router;
