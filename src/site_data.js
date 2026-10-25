/*
  What the released game says about itself, made at every release (cmake/export_site_data.py in the game's repo):
  the weapon stats, the images they name, the rank icons and the official arenas with their miniatures.
  It lies in /builds/site_data next to the builds: prod reads it from disk, dev asks the live site when it has no copy.
  The images' URLs carry the commit (nginx sends /builds without caching headers), so a release shows its own images.
  Checked every minute - loaded again when its manifest changes, so a release needs no restart.
  Without it (not uploaded yet, unreachable): the weapons from public/weapons, the images from GitHub, no official arenas.
*/
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('./config');

const GITHUB_GFX = 'https://cdn.jsdelivr.net/gh/TeamHypersomnia/Hypersomnia/hypersomnia/content/gfx/';
const WEAPON_FILES = ['firearms', 'melees', 'explosives', 'spells'];

const readBundledWeapons = () => Object.fromEntries(WEAPON_FILES.map(file =>
  [file, JSON.parse(fs.readFileSync(`./public/weapons/${file}.json`, 'utf8'))]
));

let data = {
  manifestText: null,
  version: null,
  weapons: readBundledWeapons(),
  officialArenas: [],
  base: null
};

const onDisk = () => fs.existsSync(path.join(config.SITE_DATA_PATH, 'manifest.json'));

// The reason it is not available, said once - not at every check
let lastError = null;

async function readText(file) {
  if (config.IS_PROD || onDisk()) {
    return fs.readFileSync(path.join(config.SITE_DATA_PATH, file), 'utf8');
  }

  const res = await axios.get(config.SITE_DATA_URL + file, { timeout: 5000, responseType: 'text', transformResponse: x => x });
  return res.data;
}

async function refresh() {
  try {
    const manifestText = await readText('manifest.json');

    if (manifestText === data.manifestText) {
      return;
    }

    const manifest = JSON.parse(manifestText);
    const weapons = {};

    for (const file of WEAPON_FILES) {
      weapons[file] = JSON.parse(await readText(`weapons/${file}.json`));
    }

    // Served by nginx in prod (and by app.js in dev from a local copy)
    const base = onDisk() ? '/builds/site_data/' : config.SITE_DATA_URL;
    const officialArenas = JSON.parse(await readText('official_arenas.json'))
      .map(v => ({ ...v, miniature: `${base}official_arenas/${v.name}/miniature.png` }));

    // A release being uploaded right now (rsync replaces the files one by one): its manifest is read again next time
    if (await readText('manifest.json') !== manifestText) {
      return;
    }

    data = {
      manifestText,
      // In the images' URLs: a release made again under the same tag has another commit
      commit: manifest.commit,
      version: manifest.version,
      weapons,
      officialArenas,
      base
    };

    lastError = null;
    console.log(`[site_data] Loaded ${manifest.version} (${manifest.generated_at}): ${officialArenas.length} official arenas.`);
  } catch (err) {
    if (err.message === lastError) {
      return;
    }

    lastError = err.message;

    if (data.manifestText === null) {
      console.log(`[site_data] Not available (${err.message}) - the bundled weapon stats and the images from GitHub.`);
    }
    else {
      console.error(`[site_data] Could not check for a new version, keeping ${data.version}:`, err.message);
    }
  }
}

refresh();
setInterval(refresh, config.SITE_DATA_REFRESH_INTERVAL).unref();

module.exports = {
  weapons: file => data.weapons[file],
  officialArenas: () => data.officialArenas,
  gfxUrl: file => data.base ? `${data.base}gfx/${file}?v=${encodeURIComponent(data.commit)}` : GITHUB_GFX + file
};
