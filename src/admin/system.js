const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const readline = require('readline');
const moment = require('moment');

let logFilePath;
if (process.env.NODE_ENV && process.env.NODE_ENV === 'production') {
  logFilePath = '/var/log/nginx/access.log';
} else {
  logFilePath = './private/access.log';
}

function formatUptime(uptime) {
  const d = Math.floor(uptime / (3600 * 24));
  const h = String(Math.floor((uptime % (3600 * 24)) / 3600)).padStart(2, '0');
  const m = String(Math.floor((uptime % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(uptime % 60)).padStart(2, '0');
  if (d > 1) {
    return `${d}d ${h}:${m}:${s}`;
  }
  return `${h}:${m}:${s}`;
}

function parseNginxLogLine(line) {
  const logPattern = /^(\S+) - - \[(\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [\+\-]\d{4})\] "(.*?)" (\d{3}) (\d+) "(.*?)" "(.*?)"/;
  const match = line.match(logPattern);
  if (match) {
    const [_, ip, timestamp, request, status, size, referer, userAgent] = match;
    return {
      ip,
      timestamp: moment(timestamp, "DD/MMM/YYYY:HH:mm:ss Z").fromNow(),
      request,
      status,
      size,
      referer,
      userAgent
    };
  } else {
    return null;
  }
}

function tailLogFile(n = 30) {
  if (!fs.existsSync(logFilePath)) {
    return [];
  }

  const lines = [];
  const stream = fs.createReadStream(logFilePath, { encoding: 'utf8', flags: 'r' });
  const rl = readline.createInterface({ input: stream });

  rl.on('line', (line) => {
    lines.push(line.trim());
  });

  return new Promise((resolve, reject) => {
    rl.on('close', () => {
      const formattedLogs = lines.slice(-n).map(parseNginxLogLine).filter(log => log !== null);
      resolve(formattedLogs);
    });
    rl.on('error', (err) => {
      reject(err);
    });
  });
}

router.get('/', async (req, res) => {
  const logs = await tailLogFile();
  res.render('admin/system', {
    page: 'System',
    user: req.user,
    hostname: os.hostname(),
    loadavg: os.loadavg(),
    machine: os.machine(),
    type: os.type(),
    release: os.release(),
    uptime: formatUptime(os.uptime()),
    usedmem: os.totalmem() - os.freemem(),
    totalmem: os.totalmem(),
    node: process.version,
    appuptime: formatUptime(process.uptime()),
    accessLogs: logs.reverse()
  });
});

module.exports = router;
