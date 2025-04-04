const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = `${__dirname}/../../private/authorized_mappers.json`;

function loadCreators() {
  try {
    const d = fs.readFileSync(path, 'utf8');
    const obj = JSON.parse(d);
    return obj;
  } catch (error) {
    console.error(error.message);
    return {};
  }
}

function saveCreators(obj) {
  try {
    const json = JSON.stringify(obj, null, 2);
    fs.writeFileSync(path, json, 'utf8');
  } catch (error) {
    console.error(error.message);
  }
}

function randomString(len) {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    const randomIndex = Math.floor(Math.random() * c.length);
    result += c.charAt(randomIndex);
  }
  return result;
}

router.get('/', (req, res) => {
  res.render('admin/creators', {
    page: 'Creators',
    user: req.user,
    creators: loadCreators()
  });
});

router.post('/', (req, res) => {
  if (!req.body.shorthand || req.body.shorthand.trim() === '') {
    return res.redirect('/admin/creators')
  }
  const obj = loadCreators();
  obj[randomString(50)] = {
    shorthand: req.body.shorthand,
    allow_creating_new: false,
    maps: []
  };
  saveCreators(obj);
  res.redirect('/admin/creators');
});

router.get('/:shorthand', (req, res) => {
  const obj = loadCreators();
  const c = Object.values(obj).find((obj) => obj.shorthand === req.params.shorthand);
  if (!c) {
    return res.redirect('/admin/creators');
  }
  res.render('admin/creator', {
    page: 'Creators',
    user: req.user,
    c: c
  });
});

router.post('/:shorthand', (req, res) => {
  const obj = loadCreators();
  const k = Object.keys(obj).find((k) => obj[k].shorthand === req.params.shorthand);
  if (!k) {
    return res.redirect('/admin/creators');
  }
  if (req.body.delete === 'on') {
    delete obj[k];
  } else {
    obj[k].shorthand = req.body.shorthand;
    obj[k].allow_creating_new = req.body.allow_creating_new === 'yes';
    obj[k].maps = req.body.arenas.split('\n').map((line) => line.trim());
  }
  saveCreators(obj);
  res.redirect('/admin/creators');
});

module.exports = router;
