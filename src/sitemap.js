const db = require('./db');
const { listArenas } = require('./arenas');

const SITE = 'https://hypersomnia.io';

const STATIC_PAGES = [
  ['/', 'daily', '1.0'],
  ['/weapons', 'monthly', '0.8'],
  ['/leaderboards/bomb-defusal', 'daily', '0.8'],
  ['/leaderboards/ffa', 'daily', '0.7'],
  ['/matches', 'hourly', '0.7'],
  ['/arenas', 'weekly', '0.8'],
  ['/servers', 'always', '0.7'],
  ['/disclaimer', 'yearly', '0.1'],
  ['/cookie-policy', 'yearly', '0.1']
];

const escapeXml = s => String(s).replace(/[<>&'"]/g, c => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
}[c]));

const url = (loc, changefreq, priority, lastmod) =>
  `  <url><loc>${escapeXml(SITE + loc)}</loc>` +
  (lastmod ? `<lastmod>${lastmod}</lastmod>` : '') +
  `<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;

module.exports = (req, res) => {
  const entries = STATIC_PAGES.map(([loc, freq, prio]) => url(loc, freq, prio));

  listArenas().forEach(a => {
    const date = new Date(a.version_timestamp);
    const lastmod = isNaN(date) ? null : date.toISOString().slice(0, 10);
    entries.push(url(`/arenas/${encodeURIComponent(a.name)}`, 'monthly', '0.6', lastmod));
  });

  try {
    const players = db.prepare(
      'SELECT account_id FROM mmr_team UNION SELECT account_id FROM mmr_ffa'
    ).all();
    players.forEach(p => entries.push(url(`/user/${encodeURIComponent(p.account_id)}`, 'weekly', '0.4')));
  } catch (err) {
    console.error('Sitemap: failed to list players:', err.message);
  }

  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>\n'
  );
};
