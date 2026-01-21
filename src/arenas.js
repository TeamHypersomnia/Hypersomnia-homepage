const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { timeAgo } = require('utilities/timeAgo.js');

const dirPath = path.resolve(__dirname, '../hosting/arenas');
const unplayablePath = path.resolve(__dirname, '../private/unplayable.json');
const privateDir = path.dirname(unplayablePath);

let arenas = [];

if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
}

if (!fs.existsSync(privateDir)) {
    fs.mkdirSync(privateDir, { recursive: true });
}

if (!fs.existsSync(unplayablePath)) {
    fs.writeFileSync(unplayablePath, JSON.stringify([], null, 2));
}

function getFolderSize(folderPath) {
    let totalSize = 0;
    function calculateSize(currentPath) {
        if (!fs.existsSync(currentPath)) return;
        const stats = fs.statSync(currentPath);
        if (path.basename(currentPath) === 'miniature.png') return;

        if (stats.isFile()) {
            totalSize += stats.size;
        } else if (stats.isDirectory()) {
            fs.readdirSync(currentPath).forEach(file => {
                calculateSize(path.join(currentPath, file));
            });
        }
    }
    calculateSize(folderPath);
    return (totalSize / 1024 / 1024).toFixed(2) + ' MB';
}

function loadUnplayableMaps() {
    try {
        return JSON.parse(fs.readFileSync(unplayablePath, 'utf8'));
    } catch (e) {
        return [];
    }
}

function loadArenas() {
    const startTime = Date.now();
    const unplayableMaps = loadUnplayableMaps();
    
    if (!fs.existsSync(dirPath)) return [];

    const directories = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(file => file.isDirectory());

    const loadedArenas = [];

    directories.forEach(d => {
        const arenaJsonPath = path.join(dirPath, d.name, `${d.name}.json`);
        if (fs.existsSync(arenaJsonPath)) {
            try {
                const obj = JSON.parse(fs.readFileSync(arenaJsonPath, 'utf8'));
                
                loadedArenas.push({
                    name: obj.meta.name,
                    author: obj.about.author,
                    short_description: obj.about.short_description || 'N/A',
                    full_description: obj.about.full_description || 'N/A',
                    version_timestamp: obj.meta.version_timestamp,
                    updated: timeAgo(obj.meta.version_timestamp),
                    size: getFolderSize(path.join(dirPath, d.name)),
                    playable: !unplayableMaps.includes(obj.meta.name)
                });
            } catch (err) {
                console.error(`Failed to parse ${d.name}`);
            }
        }
    });

    console.log(`Loaded ${loadedArenas.length} arenas in ${Date.now() - startTime}ms`);
    return loadedArenas;
}

arenas = loadArenas();

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const reloadArenas = debounce(() => {
    arenas = loadArenas();
}, 1000);

const arenaWatcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
    if (filename?.endsWith('.json') && !filename.endsWith('editor_view.json')) {
        reloadArenas();
    }
});

const unplayableWatcher = fs.watch(unplayablePath, (eventType) => {
    if (eventType === 'change') reloadArenas();
});

process.on('SIGINT', () => {
    arenaWatcher.close();
    unplayableWatcher.close();
    process.exit();
});

router.get('/', (req, res) => {
    if (req.query.format === 'json') return res.json(arenas);
    res.render('arenas', { page: 'Arenas', user: req.user, arenas });
});

router.get('/:arena', (req, res) => {
    const index = arenas.findIndex(v => v.name === req.params.arena);
    if (index === -1) return res.redirect('/arenas');

    res.render('arena', {
        page: arenas[index].name,
        user: req.user,
        arena: arenas[index],
        prev: arenas[index - 1]?.name || arenas[arenas.length - 1].name,
        next: arenas[index + 1]?.name || arenas[0].name
    });
});

module.exports = router;