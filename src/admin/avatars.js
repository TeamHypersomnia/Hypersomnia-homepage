const express = require('express');
const router = express.Router();
const { recentAvatars, deleteAvatar, isValidAccountId } = require('../avatars');

/*
  The avatars of the latest reported matches, for deleting offensive ones. A deleted avatar comes back
  only with the account's next reported match that has one.
*/

router.get('/', (req, res) => {
  res.render('admin/avatars', {
    page: 'Avatars',
    user: req.user,
    avatars: recentAvatars(200),
    deleted: typeof req.query.deleted === 'string' && isValidAccountId(req.query.deleted) ? req.query.deleted : null
  });
});

router.post('/delete', (req, res) => {
  const accountId = req.body.account_id;

  if (!isValidAccountId(accountId)) {
    return res.redirect('/admin/avatars');
  }

  if (deleteAvatar(accountId)) {
    console.log(`[admin] ${req.user.id} deleted the avatar of ${accountId}.`);
  }

  res.redirect(`/admin/avatars?deleted=${encodeURIComponent(accountId)}`);
});

module.exports = router;
