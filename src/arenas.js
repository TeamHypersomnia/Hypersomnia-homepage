const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { timeAgo } = require('./utilities/timeAgo');
const siteData = require('./site_data');

const dirPath = path.resolve(__dirname, '../hosting/arenas');
const unplayablePath = path.resolve(__dirname, '../private/unplayable.json');
// A list of names (["de_sapiesz", "de_suspect"]) shown with a NEW! - edited by hand on the server, read again when it changes
const newArenasPath = path.resolve(__dirname, '../private/new_arenas.json');
const privateDir = path.dirname(unplayablePath);

let arenas = [];

// a dangling symlink (the game's folder moved): no maps for now, never a crash
try {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
} catch (e) {
    console.error(`[arenas] ${dirPath}: ${e.message} - no maps listed until it's there.`);
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

function loadNewArenas() {
    try {
        const names = JSON.parse(fs.readFileSync(newArenasPath, 'utf8'));
        return Array.isArray(names) ? names : [];
    } catch (e) {
        return [];
    }
}

function loadUnplayableMaps() {
    try {
        return JSON.parse(fs.readFileSync(unplayablePath, 'utf8'));
    } catch (e) {
        return [];
    }
}

// What a list row and an arena's page show of it - a community arena or an official one
function arenaEntry(name, about, versionTimestamp) {
    return {
        name,
        author: about.author,
        short_description: about.short_description || 'N/A',
        full_description: about.full_description || 'N/A',
        version_timestamp: versionTimestamp,
        updated: timeAgo(versionTimestamp),
        ts: Math.floor(new Date(versionTimestamp).getTime() / 1000)
    };
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
                    ...arenaEntry(obj.meta.name, obj.about, obj.meta.version_timestamp),
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

/*
  The list is loaded again when an arena's JSON or unplayable.json changes - their modification times and sizes,
  checked every few seconds. fs.watch missed uploads: a map's folder made anew, a file renamed into place by rsync.
*/
function arenasSignature() {
    const parts = [];

    try {
        parts.push(fs.statSync(unplayablePath).mtimeMs);
    } catch (e) {}

    try {
        parts.push(fs.statSync(newArenasPath).mtimeMs);
    } catch (e) {}

    let entries = [];

    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (e) {}

    for (const d of entries) {
        if (!d.isDirectory()) continue;

        try {
            const stats = fs.statSync(path.join(dirPath, d.name, `${d.name}.json`));
            parts.push(`${d.name}:${stats.mtimeMs}:${stats.size}`);
        } catch (e) {}
    }

    return parts.join('|');
}

let signature = arenasSignature();
arenas = loadArenas();
let newArenas = loadNewArenas();

setInterval(() => {
    const current = arenasSignature();

    if (current !== signature) {
        signature = current;
        arenas = loadArenas();
        newArenas = loadNewArenas();
    }
}, 5000).unref();

/*
  The arenas that ship with the game, from the released version (see site_data.js) - shown, never in ?format=json:
  the servers sync the community arenas from there and have these already.
*/
function officialArenas() {
    return siteData.officialArenas()
        .filter(v => !arenas.some(c => c.name === v.name))
        .map(v => ({ ...arenaEntry(v.name, v, v.version_timestamp), miniature: v.miniature, official: true }));
}

/*
  How long ago: counted at every view - the list is loaded only when a file changes, so a time counted then stays
  as it was at that moment ("9 seconds ago" for days).
*/
const fresh = v => ({ ...v, updated: timeAgo(v.version_timestamp) });

// The newest first - and those marked new (private/new_arenas.json) with a NEW!
const newestFirst = list => list.slice().sort((a, b) => b.ts - a.ts);
const marked = v => ({ ...fresh(v), is_new: newArenas.includes(v.name) });

// The pages only - ?format=json stays as the servers know it
const shownArenas = () => newestFirst(arenas).map(v => ({ ...marked(v), miniature: `/arenas/${v.name}/miniature.png` }));
const shownOfficialArenas = () => newestFirst(officialArenas()).map(marked);

router.get('/', (req, res) => {
    if (req.query.format === 'json') return res.json(arenas.map(fresh));
    res.render('arenas', { page: 'Arenas', user: req.user, arenas: shownArenas(), official: shownOfficialArenas() });
});

router.get('/:arena', (req, res) => {
    // prev and next go through the list the arena is in
    const list = arenas.some(v => v.name === req.params.arena) ? shownArenas() : shownOfficialArenas();
    const index = list.findIndex(v => v.name === req.params.arena);
    if (index === -1) return res.redirect('/arenas');

    res.render('arena', {
        page: list[index].name,
        user: req.user,
        arena: list[index],
        prev: list[index - 1]?.name || list[list.length - 1].name,
        next: list[index + 1]?.name || list[0].name
    });
});

router.hasArena = name => arenas.some(v => v.name === name) || siteData.officialArenas().some(v => v.name === name);
// For the sitemap: the official arenas' pages too
router.listArenas = () => [...arenas, ...officialArenas()];
// the community maps, as ?format=json serves them to the servers
router.communityArenaNames = () => arenas.map(a => a.name);

module.exports = router;