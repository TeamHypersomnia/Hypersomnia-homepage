const fs = require('fs');

module.exports = {
  getFirearms: function () {
    const d = fs.readFileSync(__dirname + '/../public/weapons/firearms.json', {
      encoding: 'utf8',
      flag: 'r'
    });
    return JSON.parse(d);
  },

  getMelees: function () {
    const d = fs.readFileSync(__dirname + '/../public/weapons/melees.json', {
      encoding: 'utf8',
      flag: 'r'
    });
    return JSON.parse(d);
  },

  getExplosives: function () {
    const d = fs.readFileSync(__dirname + '/../public/weapons/explosives.json', {
      encoding: 'utf8',
      flag: 'r'
    });
    return JSON.parse(d);
  },

  getSpells: function () {
    const d = fs.readFileSync(__dirname + '/../public/weapons/spells.json', {
      encoding: 'utf8',
      flag: 'r'
    });
    return JSON.parse(d);
  }
};
