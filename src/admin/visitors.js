const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('admin/visitors', {
    page: 'Visitors',
    user: req.user
  });
});

module.exports = router;
