const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Marked } = require('marked');

/*
  "Host a server": README_SERVER.md of the game's repository, rendered with the site's look.

  The markdown is the one source - it reads fine on GitHub too. A few conventions get more here:
    > [!TIP] / [!NOTE] / [!IMPORTANT] / [!WARNING]   GitHub's alerts, drawn as callouts
    <!-- setup id=docker-run icon=docker [default] --> one way to set it up - all setups are tabs at the top, only the chosen one
    # Docker run                                        is shown and in the navigation; its first heading names the tab,
    ## 1. Start it ... <!-- /setup -->                  the rest count one level up
    <!-- only docker-compose,docker-run --> ... <!-- /only -->   shown only with these setups
    <!-- toc highlight icon=trophy -->                  the next section stands out in the navigation
    <!-- generator -->                                  the config generator
  The first list made only of #links is the table of contents for GitHub - here the navigation is made from the headings.

  Where the markdown comes from:
    SERVER_GUIDE_PATH set   - that file (a local preview, later a clone of the repository at the released tag)
    otherwise               - README_SERVER.md at the highest version tag on GitHub, ?ref=master for the coming one
*/

const REPO = 'TeamHypersomnia/Hypersomnia';
const CACHE_MS = 10 * 60 * 1000;
const CACHE_DIR = './private/server_guide_cache';
const OFFICIAL_ARENAS = ['de_cyberaqua', 'de_silo', 'fy_minilab'];

// the arenas offered by the config generator: the official servers' bomb defusal cycle
const COMMUNITY_ARENAS = [
  'de_hotline', 'de_metro', 'de_duel_practice', 'de_jedrula', 'de_billan', 'de_kremlin', 'hyperactive_space_station',
  'fy_iceworld', 'de_rambo', 'de_amongus', 'de_bogosbinted', 'de_facing_worlds', 'de_suspects'
];

const cache = new Map();
let lastReleaseTag = null;

// releases are plain version tags (4.2.0) - no GitHub Releases - so the highest one
async function latestReleaseTag() {
  const res = await axios.get(`https://api.github.com/repos/${REPO}/tags?per_page=100`, { timeout: 5000 });
  const versions = res.data.map(t => t.name).filter(n => /^\d+\.\d+\.\d+$/.test(n));
  const parts = v => v.split('.').map(Number);

  versions.sort((x, y) => {
    const [a, b] = [parts(x), parts(y)];
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
  });

  if (!versions.length) {
    throw new Error('no version tags');
  }

  return versions[0];
}

async function fetchFromGithub(ref) {
  const resolved = ref === 'release' ? await latestReleaseTag() : ref;

  if (ref === 'release') {
    lastReleaseTag = resolved;
  }

  const res = await axios.get(`https://raw.githubusercontent.com/${REPO}/${resolved}/README_SERVER.md`, {
    timeout: 5000,
    responseType: 'text'
  });
  return res.data;
}

async function getServerGuideMarkdown(ref) {
  if (process.env.SERVER_GUIDE_PATH) {
    return fs.readFileSync(process.env.SERVER_GUIDE_PATH, 'utf8');
  }

  const hit = cache.get(ref);

  if (hit && Date.now() - hit.at < CACHE_MS) {
    return hit.markdown;
  }

  const diskPath = path.join(CACHE_DIR, `${ref.replace(/[^\w.-]/g, '_')}.md`);

  try {
    const markdown = await fetchFromGithub(ref);
    cache.set(ref, { markdown, at: Date.now() });
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(diskPath, markdown);
    return markdown;
  } catch (err) {
    console.error(`[host] could not fetch README_SERVER.md at ${ref}: ${err.message}`);

    // GitHub down: the last copy we had, and try again in a minute
    if (hit) {
      hit.at = Date.now() - CACHE_MS + 60 * 1000;
      return hit.markdown;
    }

    if (fs.existsSync(diskPath)) {
      const markdown = fs.readFileSync(diskPath, 'utf8');
      cache.set(ref, { markdown, at: Date.now() - CACHE_MS + 60 * 1000 });
      return markdown;
    }

    throw err;
  }
}

// GitHub's heading anchors: lowercase, punctuation dropped, spaces to dashes, -1 -2 for repeats
function makeSlugger() {
  const seen = new Map();

  return text => {
    const base = text
      .toLowerCase()
      .trim()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');

    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };
}

const ALERTS = {
  NOTE: { icon: 'fa-circle-info', title: 'Note' },
  TIP: { icon: 'fa-lightbulb', title: 'Tip' },
  IMPORTANT: { icon: 'fa-flag', title: 'Important' },
  WARNING: { icon: 'fa-triangle-exclamation', title: 'Warning' },
  CAUTION: { icon: 'fa-skull', title: 'Caution' }
};

// "<!-- setup id=docker-run icon=docker -->" -> { setup: 'docker-run', icon: 'docker' }
function commentArgs(comment, keyword) {
  const m = new RegExp(`^<!--\\s*${keyword}\\b(.*?)-->$`).exec(comment);

  if (!m) {
    return null;
  }

  const args = {};
  const words = m[1].trim().split(/\s+/).filter(Boolean);

  words.forEach(w => {
    const [k, v] = w.split('=');
    args[k] = v === undefined ? true : v;
  });

  args._words = words;
  return args;
}

const SETUP_ICONS = {
  docker: 'fa-brands fa-docker',
  linux: 'fa-brands fa-linux',
  flask: 'fa-solid fa-flask',
  server: 'fa-solid fa-server',
  trophy: 'fa-solid fa-trophy'
};

const TOC_ICONS = {
  trophy: 'fa-solid fa-trophy',
  gear: 'fa-solid fa-gear'
};

function renderGuide(markdown, ref) {
  const slug = makeSlugger();
  const sections = [];
  const setups = [];
  let title = 'Host a server';
  let tocDropped = false;
  let headingsSeen = 0;
  let setup = null;
  let pendingToc = null;

  const marked = new Marked({ gfm: true });
  const plain = new Marked({ gfm: true });

  marked.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        const id = slug(text);

        if (headingsSeen++ === 0) {
          title = text;
          return `<h1 class="guide-title" id="${id}">${inner}</h1>\n<!--SETUP_TABS-->\n`;
        }

        // the first heading of a setup only names its tab ("AppImage: persistent server" in a group); the rest go one level up
        if (setup && !setup.label) {
          setup.label = setup.group && text.includes(': ') ? text.slice(text.indexOf(': ') + 2) : text;
          setup.label = setup.label.charAt(0).toUpperCase() + setup.label.slice(1);
          setup.anchor = id;
          return `<span class="guide-setup-anchor" id="${id}"></span>\n`;
        }

        const level = setup ? depth - 1 : depth;

        if (level === 1) {
          sections.push({
            id,
            text,
            setup: setup ? setup.id : null,
            highlight: pendingToc !== null && pendingToc.highlight === true,
            icon: pendingToc !== null && TOC_ICONS[pendingToc.icon] ? TOC_ICONS[pendingToc.icon] : null,
            // "<!-- toc children -->": its own sections are listed under it in the navigation
            children: pendingToc !== null && pendingToc.children === true ? [] : null
          });

          pendingToc = null;
        }
        else if (level === 2 && !setup) {
          const chapter = sections[sections.length - 1];

          if (chapter && chapter.children) {
            chapter.children.push({ id, text });
          }
        }

        const tag = Math.min(level + 1, 6);
        return `<h${tag} id="${id}"><a class="guide-anchor" href="#${id}">#</a>${inner}</h${tag}>\n`;
      },

      blockquote({ tokens }) {
        const first = tokens[0];
        const match = first && first.type === 'paragraph' && /^\[!(\w+)\]\s*/.exec(first.raw);
        const alert = match && ALERTS[match[1].toUpperCase()];

        if (!alert) {
          return `<blockquote>${this.parser.parse(tokens)}</blockquote>\n`;
        }

        const rest = first.raw.slice(match[0].length);
        const body = (rest ? `<p>${plain.parseInline(rest)}</p>` : '') + this.parser.parse(tokens.slice(1));
        const kind = match[1].toLowerCase();
        return `<div class="guide-alert guide-alert-${kind}"><div class="guide-alert-title"><i class="fa-solid ${alert.icon}"></i>${alert.title}</div>${body}</div>\n`;
      },

      list(token) {
        // every item (and every nested one) is only #links
        const onlyAnchors = token.items.length > 0 && token.items.every(i => i.text.split('\n').every(line => /^\s*(-\s*)?(\[[^\]]+\]\(#[^)]+\)\s*·?\s*)+$/.test(line)));

        // the table of contents for GitHub - here the side navigation is made from the headings
        if (!tocDropped && onlyAnchors) {
          tocDropped = true;
          return '';
        }

        return false;
      },

      // a picture next to README_SERVER.md (e.g. docs/images/...) - served through /host/asset
      image({ href, title, text }) {
        const src = /^[a-z]+:|^\//i.test(href) ? href : `/host/asset/${href}?ref=${encodeURIComponent(ref)}`;
        const t = title ? ` title="${title}"` : '';
        return `<img class="guide-image" src="${src}" alt="${text}"${t} loading="lazy">`;
      },

      // ```ini title="/etc/systemd/system/hypersomnia.service" - the file as the block's first line
      code({ text, lang: info }) {
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const lang = (info || '').split(/\s+/)[0];
        const title = /title="([^"]+)"/.exec(info || '');

        if (title) {
          const file = title[1].replace(/&/g, '&amp;').replace(/</g, '&lt;');
          return `<div class="guide-code with-file"><div class="guide-code-file"><code>${file}</code><button type="button" class="gen-inline-copy" title="Copy the path"><i class="fa-regular fa-copy"></i></button></div><button type="button" class="guide-copy" title="Copy"><i class="fa-regular fa-copy"></i></button><pre><code data-lang="${lang === 'sh' ? 'bash' : lang}">${escaped}</code></pre></div>\n`;
        }

        const label = lang ? `<span class="guide-code-lang">${lang}</span>` : '';
        return `<div class="guide-code">${label}<button type="button" class="guide-copy" title="Copy"><i class="fa-regular fa-copy"></i></button><pre><code${lang ? ` data-lang="${lang === 'sh' ? 'bash' : lang}"` : ''}>${escaped}</code></pre></div>\n`;
      },

      html({ text }) {
        const comment = text.trim();

        const setupArgs = commentArgs(comment, 'setup');

        if (setupArgs) {
          setup = {
            id: setupArgs.id,
            group: setupArgs.group || null,
            // group-label=Persistent_server - no spaces in the comment's arguments
            groupLabel: setupArgs['group-label'] ? setupArgs['group-label'].replace(/_/g, ' ') : null,
            groupIcon: setupArgs['group-icon'] ? SETUP_ICONS[setupArgs['group-icon']] : null,
            icon: SETUP_ICONS[setupArgs.icon] || 'fa-solid fa-server',
            isDefault: setupArgs.default === true,
            label: null
          };

          setups.push(setup);
          const def = setup.isDefault ? ' data-default="1"' : '';
          return `<section class="guide-setup" data-setup="${setup.id}" data-group="${setup.group || setup.id}"${def}>\n`;
        }

        if (comment === '<!-- /setup -->') {
          setup = null;
          return '</section>\n';
        }

        const onlyArgs = commentArgs(comment, 'only');

        if (onlyArgs) {
          return `<div class="guide-only" data-setups="${onlyArgs._words.join(' ')}">\n`;
        }

        if (comment === '<!-- /only -->') {
          return '</div>\n';
        }

        const tocArgs = commentArgs(comment, 'toc');

        if (tocArgs) {
          pendingToc = tocArgs;
          return '';
        }

        if (comment === '<!-- generator -->') {
          return '<div id="config-generator"></div>\n';
        }

        return false;
      }
    }
  });

  // render first: the tabs need the labels collected while rendering
  const rendered = marked.parse(markdown);

  // a tab per group of setups (or a lone setup); a group of several also has a row of its own
  const groups = [];

  setups.forEach(s => {
    const key = s.group || s.id;
    let g = groups.find(x => x.key === key);

    if (!g) {
      g = { key, label: s.groupLabel || s.label, icon: s.groupIcon || s.icon, members: [] };
      groups.push(g);
    }

    g.members.push(s);
  });

  const def = setup => setup.isDefault ? ' data-default="1"' : '';

  const tabs = groups.length === 0 ? '' : [
    '<div class="btn-group guide-setup-tabs">',
    ...groups.map(g => {
      const first = g.members.find(m => m.isDefault) || g.members[0];
      return `<div class="btn"><button type="button" data-group="${g.key}" data-setup="${first.id}"${def(first)}><i class="${g.icon}"></i>${g.label}</button></div>`;
    }),
    '</div>',
    ...groups.filter(g => g.members.length > 1).map(g => [
      `<div class="btn-group guide-setup-subtabs" data-group="${g.key}" id="${g.key}">`,
      ...g.members.map(m => `<div class="btn"><button type="button" data-group="${g.key}" data-setup="${m.id}"${def(m)}><i class="${m.icon}"></i>${m.label}</button></div>`),
      '</div>'
    ].join(''))
  ].join('');

  const html = rendered
    .replace('<!--SETUP_TABS-->', tabs)
    // links to the site itself stay on it (also in a local preview)
    .replace(/href="https:\/\/hypersomnia\.io\//g, 'href="/')
    // a bold link alone in its paragraph is a button, e.g. **[Open the config generator](...)**
    .replace(/<p><strong><a href="([^"]+)">([^<]+)<\/a><\/strong><\/p>/g, '<p><a class="guide-button" href="$1">$2</a></p>')
    .replace(/<table>/g, '<div class="guide-table"><table>')
    .replace(/<\/table>/g, '</table></div>');

  return { title, html, sections, setups, tabs };
}

// pictures the guide refers to: next to the local file in a preview, otherwise from GitHub at the same ref
router.get('/asset/*path', (req, res) => {
  const rel = req.params.path.join('/');
  const ref = typeof req.query.ref === 'string' && /^[\w.-]{1,64}$/.test(req.query.ref) ? req.query.ref : 'master';

  if (!/^[\w./-]+\.(png|jpg|jpeg|gif|webp|svg)$/i.test(rel) || rel.includes('..')) {
    return res.status(404).end();
  }

  if (process.env.SERVER_GUIDE_PATH) {
    return res.sendFile(path.resolve(path.dirname(process.env.SERVER_GUIDE_PATH), rel));
  }

  const at = ref === 'release' ? lastReleaseTag || 'master' : ref;
  res.redirect(302, `https://raw.githubusercontent.com/${REPO}/${at}/${rel}`);
});

router.get('/', async (req, res) => {
  const ref = typeof req.query.ref === 'string' && /^[\w.-]{1,64}$/.test(req.query.ref) ? req.query.ref : 'release';

  try {
    const guide = renderGuide(await getServerGuideMarkdown(ref), ref);

    res.render('host', {
      page: 'Host a Server',
      user: req.user,
      guide,
      arenas: {
        official: OFFICIAL_ARENAS,
        community: COMMUNITY_ARENAS
      },
      noindex: ref !== 'release'
    });
  } catch (err) {
    res.status(503).render('error', {
      page: 'Host a Server',
      user: req.user,
      message: 'The guide could not be loaded. Read it on GitHub: https://github.com/TeamHypersomnia/Hypersomnia/blob/master/README_SERVER.md'
    });
  }
});

/*
  /generator: only the config generator, centered on the dark background - for the admins who need nothing else.
  Its setup tabs come from the same README_SERVER.md as the guide's.
*/

/*
  The generator's tabs: what the server is for, then how it runs - its own, apart from the guide.
*/

const GENERATOR_SETUPS = [
  { group: 'server', label: 'Persistent server', icon: 'fa-solid fa-server', members: [
    { id: 'server-appimage', label: 'AppImage', icon: 'fa-brands fa-linux', isDefault: true },
    { id: 'server-compose', label: 'Docker compose', icon: 'fa-brands fa-docker' },
    { id: 'server-run', label: 'Docker run', icon: 'fa-brands fa-docker' }
  ] },
  { group: 'tournament', label: 'Tournament', icon: 'fa-solid fa-trophy', members: [
    { id: 'tournament-appimage', label: 'AppImage', icon: 'fa-brands fa-linux' },
    { id: 'tournament-compose', label: 'Docker compose', icon: 'fa-brands fa-docker' },
    { id: 'tournament-run', label: 'Docker run', icon: 'fa-brands fa-docker' }
  ] }
];

function generatorTabs() {
  const def = m => m.isDefault ? ' data-default="1"' : '';

  return [
    '<div class="btn-group guide-setup-tabs">',
    ...GENERATOR_SETUPS.map(g => {
      const first = g.members.find(m => m.isDefault) || g.members[0];
      return `<div class="btn"><button type="button" data-group="${g.group}" data-setup="${first.id}"${def(first)}><i class="${g.icon}"></i>${g.label}</button></div>`;
    }),
    '</div>',
    ...GENERATOR_SETUPS.map(g => [
      `<div class="btn-group guide-setup-subtabs" data-group="${g.group}" id="${g.group}">`,
      ...g.members.map(m => `<div class="btn"><button type="button" data-group="${g.group}" data-setup="${m.id}"${def(m)}><i class="${m.icon}"></i>${m.label}</button></div>`),
      '</div>'
    ].join(''))
  ].join('');
}

/*
  /generator: only the config generator, centered on the dark background - for the admins who need nothing else.
*/

router.generatorPage = (req, res) => {
  res.render('generator', {
    tabs: generatorTabs(),
    arenas: {
      official: OFFICIAL_ARENAS,
      community: COMMUNITY_ARENAS
    }
  });
};

module.exports = router;
