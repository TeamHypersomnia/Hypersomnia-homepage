const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const readline = require('readline');
const config = require('../config');

const LOG_PATH = config.IS_PROD ? '/var/log/nginx/access.log' : './private/access.log';
const LOG_PATTERN = /^(\S+) - - \[(\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [\+\-]\d{4})\] "(.*?)" (\d{3}) (\d+) "(.*?)" "(.*?)"/;

function formatUptime(uptime) {
  const d = Math.floor(uptime / (3600 * 24));
  const h = String(Math.floor((uptime % (3600 * 24)) / 3600)).padStart(2, '0');
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(uptime % 60)).padStart(2, '0');
  return d > 1 ? `${d}d ${h}:${m}:${s}` : `${h}:${m}:${s}`;
}

function parseLogLine(line) {
  const match = line.match(LOG_PATTERN);
  if (!match) return null;
  
  const [_, ip, timestamp, request, status, size, referer, userAgent] = match;
  return {
    ip,
    timestamp,
    request,
    status,
    size,
    referer,
    userAgent
  };
}

async function getRecentLogs(count = 30) {
  if (!fs.existsSync(LOG_PATH)) return [];
  
  const lines = [];
  const stream = fs.createReadStream(LOG_PATH, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream });
  
  rl.on('line', (line) => lines.push(line.trim()));
  
  return new Promise((resolve, reject) => {
    rl.on('close', () => {
      const logs = lines.slice(-count).map(parseLogLine).filter(Boolean);
      resolve(logs);
    });
    rl.on('error', reject);
  });
}

router.get('/', async (req, res) => {
  const logs = await getRecentLogs();
  const memory = process.memoryUsage();
  
  res.render('admin/overview', {
    page: 'Overview',
    user: req.user,
    hostname: os.hostname(),
    loadavg: os.loadavg(),
    uptime: formatUptime(os.uptime()),
    usedmem: os.totalmem() - os.freemem(),
    totalmem: os.totalmem(),
    appversion: process.version,
    appuptime: formatUptime(process.uptime()),
    appusedmem: memory.rss,
    accessLogs: logs.reverse()
  });
});

module.exports = router;