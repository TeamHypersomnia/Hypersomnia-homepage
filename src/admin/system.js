const express = require('express');
const router = express.Router();
const os = require('os');

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

router.get('/', (req, res) => {
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
    appuptime: formatUptime(process.uptime())
  });
});

module.exports = router;
