const fs = require('fs');
const path = __dirname + '/../../private/settings.json';

module.exports = {
  load: function () {
    try {
      const fileContent = fs.readFileSync(path, 'utf8');
      const obj = JSON.parse(fileContent);
      return obj;
    } catch (error) {
      console.error(`Error reading settings: ${error.message}`);
      return null;
    }
  },

  save: function (obj) {
    try {
      const json = JSON.stringify(obj, null, 2);
      fs.writeFileSync(path, json, 'utf8');
    } catch (error) {
      console.error(`Error writing settings ${error.message}`);
      return null;
    }
  }
};
