const fs = require('fs');

module.exports = {
  getFirearms: function () {
    const jsonData = fs.readFileSync(__dirname + '/../public/weapons/firearms.json', {
      encoding: 'utf8',
      flag: 'r'
    });
    return JSON.parse(jsonData);
  },

  getMelees: function () {
    const jsonData = fs.readFileSync(__dirname + '/../public/weapons/melees.json', {
      encoding: 'utf8',
      flag: 'r'
    });
    return JSON.parse(jsonData);
  },

  getExplosives: function () {
    const jsonData = fs.readFileSync(__dirname + '/../public/weapons/explosives.json', {
      encoding: 'utf8',
      flag: 'r'
    });
    return JSON.parse(jsonData);
  },

  getSpells: function () {
    const jsonData = fs.readFileSync(__dirname + '/../public/weapons/spells.json', {
      encoding: 'utf8',
      flag: 'r'
    });
    return JSON.parse(jsonData);
  }
};
