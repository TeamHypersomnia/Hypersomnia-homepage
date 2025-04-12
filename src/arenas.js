const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const chokidar = require('chokidar');
const dirPath = __dirname + '/../public/arenas';
const unplayablePath = __dirname + '/../private/unplayable.json';
let arenas = [];

function getFolderSize(folderPath) {
  let totalSize = 0;
  function calculateSize(currentPath) {
    const stats = fs.statSync(currentPath);
    if (path.basename(currentPath) === 'miniature.png') {
      return;
    }
    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        calculateSize(path.join(currentPath, file));
      });
    }
  }
  calculateSize(folderPath);
  const sizeInKilobytes = totalSize / 1024;
  const sizeInMegabytes = sizeInKilobytes / 1024;
  return sizeInMegabytes.toFixed(2) + ' MB';
}

function loadUnplayableMaps() {
  if (fs.existsSync(unplayablePath)) {
    const unplayableContent = fs.readFileSync(unplayablePath, 'utf8');
    return JSON.parse(unplayableContent);
  }
  return [];
}

function loadArenas() {
  const startTime = Date.now();

  const unplayableMaps = loadUnplayableMaps();
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  const directories = files.filter(file => file.isDirectory());
  const arenas = [];

  directories.forEach(d => {
    const arenaPath = `${dirPath}/${d.name}/${d.name}.json`;
    if (fs.existsSync(arenaPath)) {
      const fileContent = fs.readFileSync(arenaPath, 'utf8');
      const obj = JSON.parse(fileContent);

      const format = 'YYYY-MM-DD HH:mm:ss.SSSSSS Z';
      const dateObject = moment.utc(obj.meta.version_timestamp, format);
      const timeAgo = dateObject.fromNow();
      const size = getFolderSize(`${dirPath}/${d.name}`);

      let short_description = 'N/A';
      if (obj.about.short_description) {
        short_description = obj.about.short_description;
      }

      let full_description = 'N/A';
      if (obj.about.full_description) {
        full_description = obj.about.full_description;
      }

      const playable = !unplayableMaps.includes(obj.meta.name);

      arenas.push({
        name: obj.meta.name,
        author: obj.about.author,
        short_description: short_description,
        full_description: full_description,
        version_timestamp: obj.meta.version_timestamp,
        updated: timeAgo,
        size: size,
        playable: playable
      });
    }
  });

  const endTime = Date.now();
  const elapsed = endTime - startTime;

  console.log(`Loaded ${arenas.length} arenas successfully in ${elapsed}ms`);
  return arenas;
}

arenas = loadArenas();

const arenaWatcher = chokidar.watch(dirPath, {
  ignoreInitial: true,
  persistent: true,
  recursive: true,
  ignored: (path, stats) => {
    if (!stats?.isFile()) return false
    if (path.endsWith('editor_view.json')) return true
    return !path.endsWith('.json')
  }
});

arenaWatcher.on('all', (event, path) => {
  console.log(event, path);
  arenas = loadArenas();
});

arenaWatcher.on('error', (error) => {
  console.error(`Watcher error: ${error}`);
});

const unplayableWatcher = chokidar.watch(unplayablePath, {
  ignoreInitial: true,
  persistent: true
});

unplayableWatcher.on('change', (path) => {
  console.log(`Unplayable maps file changed: ${path}`);
  arenas = loadArenas();
});

unplayableWatcher.on('error', (error) => {
  console.error(`Watcher error: ${error}`);
});

process.on('SIGINT', () => {
  arenaWatcher.close();
  unplayableWatcher.close();
  process.exit();
});

router.get('/', function (req, res) {
  if (req.query.format !== undefined && req.query.format == 'json') {
    return res.json(arenas);
  }
  res.render('arenas', {
    page: 'Arenas',
    user: req.user,
    arenas: arenas
  });
});

router.get('/:arena', function (req, res) {
  const index = arenas.findIndex(v => v.name === req.params.arena);
  if (index === -1) {
    return res.redirect('/arenas');
  }
  let prev = arenas[arenas.length - 1].name;
  if (arenas[index - 1] !== undefined) {
    prev = arenas[index - 1].name;
  }
  let next = arenas[0].name;
  if (arenas[index + 1] !== undefined) {
    next = arenas[index + 1].name;
  }
  res.render('arena', {
    page: arenas[index].name,
    user: req.user,
    arena: arenas[index],
    prev: prev,
    next: next
  });
});

module.exports = router;
