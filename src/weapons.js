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

const firearms = getWeapons('firearms');
const melees = getWeapons('melees');
const explosives = getWeapons('explosives');
const spells = getWeapons('spells');

router.get('/', function (req, res) {
  res.render('weapons', {
    page: 'Weapons',
    user: req.user,
    firearms, melees, explosives, spells
  });
});

module.exports = router;
