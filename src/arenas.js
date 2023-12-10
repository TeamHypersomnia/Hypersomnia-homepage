const fs = require('fs');
const path = require('path');
const moment = require('moment');
const chokidar = require('chokidar');
const dirPath = __dirname + '/../public/arenas';
let arenas = [];

function getFolderSize(folderPath) {
  let totalSize = 0;
  function calculateSize(currentPath) {
    const stats = fs.statSync(currentPath);
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

function loadArenas() {
  try {
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
  
        arenas.push({
          name: obj.meta.name,
          author: obj.about.author,
          short_description: short_description,
          full_description: full_description,
          version_timestamp: obj.meta.version_timestamp,
          updated: timeAgo,
          size: size
        });
      }
    });
    console.log(`Loaded ${arenas.length} arenas successfully`);
    return arenas;
  } catch (err) {
    console.error(`Error reading directory: ${err}`);
    return [];
  }
}

module.exports = {
  init: function () {
    arenas = loadArenas();

    const watcher = chokidar.watch(`${dirPath}/**/*.json`, {
      ignoreInitial: true,
      persistent: true,
      recursive: true,
      ignored: '**/editor_view.json'
    });

    watcher.on('all', (event, path) => {
      console.log(event, path);
      arenas = loadArenas();
    });
    
    watcher.on('error', (error) => {
      console.error(`Watcher error: ${error}`);
    });
    
    process.on('SIGINT', () => {
      watcher.close();
      process.exit();
    });
    
    console.log(`Watching for changes in arenas...`);
  },

  getArenas: function () {
    return arenas;
  }
};
