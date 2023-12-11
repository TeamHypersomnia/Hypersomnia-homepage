const express = require('express');
const router = express.Router();
const moment = require('moment');

module.exports = function(visitors) {
  router.get('/', (req, res) => {
    const updatedVisitors = Object.fromEntries(
      Object.entries(visitors).map(([k, v]) => [
        k,
        {
          ...v,
          lastSeen: moment(v.lastSeen * 1000).fromNow()
        }
      ])
    );
    res.render('admin/visitors', {
      page: 'Visitors',
      user: req.user,
      visitors: updatedVisitors
    });
  });

  return router;
};
