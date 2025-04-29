const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = './private/settings.json';

function loadSettings() {
  try {
    const d = fs.readFileSync(path, 'utf8');
    const obj = JSON.parse(d);
    return obj;
  } catch (error) {
    console.error(error.message);
    return {};
  }
}

function saveSettings(obj) {
  try {
    const json = JSON.stringify(obj, null, 2);
    fs.writeFileSync(path, json, 'utf8');
  } catch (error) {
    console.error(error.message);
  }
}

module.exports = function(locals) {
  router.get('/', (req, res) => {
    res.render('admin/settings', {
      page: 'Settings',
      user: req.user
    });
  });
  
  router.post('/', (req, res) => {
    const obj = loadSettings();
    obj.alert = req.body.alert;
    locals.alert = req.body.alert;
    saveSettings(obj);
    res.redirect('/admin/settings');
  });

  return router;
};
