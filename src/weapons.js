const express = require('express');
const router = express.Router();
const fs = require('fs');

function getWeapons(file) {
  const path = `${__dirname}/../public/weapons/${file}.json`;
  const data = fs.readFileSync(path, {
    encoding: 'utf8',
    flag: 'r'
  });
  return JSON.parse(data);
}

router.get('/', function (req, res) {
  res.render('weapons', {
    page: 'Weapons',
    user: req.user,
    firearms: getWeapons('firearms'),
    melees: getWeapons('melees'),
    explosives: getWeapons('explosives'),
    spells: getWeapons('spells')
  });
});

module.exports = router;
