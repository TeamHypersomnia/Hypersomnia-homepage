// Sizes of the downloadable game builds, shown next to the download links.
// Kept in memory and refreshed in the background so rendering never waits.
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const config = require('./config');

const FILES = [
  'Hypersomnia-for-Windows.zip',
  'Hypersomnia.AppImage',
  'Hypersomnia-for-MacOS.dmg'
];

let sizes = {};

const statSize = async file =>
  (await fs.stat(path.join(config.BUILDS_PATH, file))).size;

const headSize = async file => {
  const res = await axios.head(config.BUILDS_URL + file, { timeout: 5000 });
  return Number(res.headers['content-length']);
};

const format = bytes => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

async function refresh() {
  const getSize = config.IS_PROD ? statSize : headSize;
  const next = {};

  await Promise.all(FILES.map(async file => {
    try {
      const bytes = await getSize(file);
      if (bytes > 0) next[file] = format(bytes);
    } catch (_) {
      // missing file: just show no size
    }
  }));

  sizes = next;
}

refresh();
setInterval(refresh, config.BUILD_SIZES_REFRESH_INTERVAL).unref();

module.exports = { get: () => sizes };
