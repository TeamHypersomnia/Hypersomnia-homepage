/*
  /host: the setup tabs, copy buttons, the side navigation's current section, and the config generator.
*/
(function () {
  const guide = document.querySelector('.guide');

  if (!guide) {
    return;
  }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);

    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'text') {
        e.textContent = v;
      }
      else if (k === 'html') {
        e.innerHTML = v;
      }
      else {
        e.setAttribute(k, v);
      }
    });

    (children || []).forEach(c => e.appendChild(c));
    return e;
  }

  function buttonGroup(names, onSelect) {
    const buttons = names.map((name, i) => {
      const b = el('button', { type: 'button', text: name });
      b.addEventListener('click', () => {
        buttons.forEach(x => x.classList.toggle('active', x === b));
        onSelect(i);
      });
      return b;
    });

    buttons[0].classList.add('active');
    const group = el('div', { class: 'btn-group guide-tab-buttons' }, buttons.map(b => el('div', { class: 'btn' }, [b])));
    group.select = i => buttons[i].click();
    return group;
  }

  /* ---------- setups: the tabs at the top pick what is shown, in the article and in the navigation ---------- */

  const SETUP_KEY = 'host_setup_v4';
  const setupSections = Array.from(document.querySelectorAll('.guide-setup'));
  const tabButtons = Array.from(document.querySelectorAll('.guide-setup-tabs button'));

  /*
    The setups as the tabs name them - the same on the guide and on /generator (which has no sections):
    a group's own tabs, or the group's tab itself when it has none.
  */

  const setupGroups = new Map();

  document.querySelectorAll('.guide-setup-subtabs button').forEach(b => setupGroups.set(b.dataset.setup, b.dataset.group));
  tabButtons.forEach(b => {
    if (!document.querySelector(`.guide-setup-subtabs[data-group="${b.dataset.group}"]`)) {
      setupGroups.set(b.dataset.setup, b.dataset.group);
    }
  });

  const setupIds = Array.from(setupGroups.keys());
  const groupOf = id => setupGroups.get(id) || id;
  const defaultButton = document.querySelector('.guide-setup-subtabs button[data-default], .guide-setup-tabs button[data-default]');
  const subtabRows = Array.from(document.querySelectorAll('.guide-setup-subtabs'));
  const subtabButtons = Array.from(document.querySelectorAll('.guide-setup-subtabs button'));
  const setupListeners = [];
  let currentSetup = setupIds[0];

  /*
    The tabs are what the server is for (Just trying it out, Persistent server, Tournament), their own tabs how it runs.
    The generator works by the second: in a terminal, as a service, with Docker compose or docker run.
  */

  const METHOD = {
    'tournament-appimage': 'terminal',
    'server-appimage': 'service',
    'server-compose': 'compose',
    'tournament-compose': 'compose',
    'tournament-run': 'run',
    'server-run': 'run'
  };

  const method = () => {
    if (currentSetup === 'server-appimage') {
      return state.asService ? 'service' : 'terminal';
    }

    return METHOD[currentSetup] || 'terminal';
  };
  const isTournament = () => currentSetup.startsWith('tournament');

  function selectSetup(id) {
    const group = groupOf(id);
    currentSetup = id;

    tabButtons.forEach(b => {
      const mine = b.dataset.group === group;
      b.classList.toggle('active', mine);

      // the group's tab brings back the setup last chosen in it
      if (mine) {
        b.dataset.setup = id;
      }
    });

    subtabRows.forEach(r => { r.hidden = r.dataset.group !== group; });
    subtabButtons.forEach(b => b.classList.toggle('active', b.dataset.setup === id));
    setupSections.forEach(s => { s.hidden = s.dataset.setup !== id; });

    document.querySelectorAll('.guide-only').forEach(o => {
      const wanted = o.dataset.setups.split(/[ ,]/);
      o.hidden = !wanted.includes(id) && !wanted.includes(group);
    });

    document.querySelectorAll('.guide-nav a[data-setup]').forEach(a => { a.hidden = a.dataset.setup !== id; });

    try {
      localStorage.setItem(SETUP_KEY, id);
    }
    catch (e) {}

    setupListeners.forEach(f => f(id));
  }

  tabButtons.concat(subtabButtons).forEach(b => b.addEventListener('click', () => selectSetup(b.dataset.setup)));

  // a link to a setup or into it (e.g. /host#appimage) opens that setup; otherwise the last one chosen
  const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;

  const linkedSetup = (() => {
    if (!target) {
      return null;
    }

    const section = target.closest('.guide-setup');

    if (section) {
      return section.dataset.setup;
    }

    // a group's own anchor, e.g. #appimage
    const first = setupSections.find(s => s.dataset.group === target.id);
    return first ? first.dataset.setup : null;
  })();

  const initialSetup = (() => {
    if (linkedSetup) {
      return linkedSetup;
    }

    try {
      const saved = localStorage.getItem(SETUP_KEY);

      if (setupIds.includes(saved)) {
        return saved;
      }
    }
    catch (e) {}

    return defaultButton ? defaultButton.dataset.setup : setupIds[0];
  })();

  if (setupIds.length) {
    selectSetup(initialSetup);
  }

  if (linkedSetup && target) {
    target.scrollIntoView();
  }

  /* ---------- copy buttons ---------- */

  function copyText(text, button) {
    const done = () => {
      button.classList.add('copied');
      button.innerHTML = '<i class="fa-solid fa-check"></i>';
      setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = '<i class="fa-regular fa-copy"></i>';
      }, 1200);
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done, () => {});
    }
  }

  document.addEventListener('click', e => {
    const button = e.target.closest('.guide-copy, .gen-inline-copy');

    if (button) {
      const source = button.classList.contains('guide-copy') ? button.parentElement.querySelector('pre code') : button.parentElement.querySelector('code');
      copyText(source.textContent, button);
    }
  });

  /* ---------- syntax colors (highlight.js, styled in host.css with the site's colors) ---------- */

  function highlight(codeEl, lang) {
    if (!window.hljs) {
      return;
    }

    codeEl.className = lang ? `language-${lang}` : '';
    delete codeEl.dataset.highlighted;

    if (lang && window.hljs.getLanguage(lang)) {
      window.hljs.highlightElement(codeEl);
    }
  }

  guide.querySelectorAll('.guide-code code[data-lang]').forEach(c => highlight(c, c.dataset.lang));

  /* ---------- side navigation: highlight the section on screen ---------- */

  const navLinks = Array.from(document.querySelectorAll('.guide-nav a[href^="#"]'));
  const headings = navLinks.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);

  function updateNav() {
    let active = headings[0];

    headings.forEach(h => {
      if (h.offsetParent !== null && h.getBoundingClientRect().top < 120) {
        active = h;
      }
    });

    navLinks.forEach(a => a.classList.toggle('active', active && a.getAttribute('href') === '#' + active.id));
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ---------- config generator ---------- */

  const mount = document.getElementById('config-generator');

  if (!mount) {
    return;
  }

  const arenas = window.HOST_ARENAS || { official: ['de_cyberaqua'], community: [] };
  const STORAGE_KEY = 'host_generator_v1';

  const defaults = {
    name: '',
    cycle: [],
    slots: 16,
    admins: '',
    password: '',
    casual: 1,
    port: 8412,
    webPort: 9000,
    timeZone: '',
    autoupdate: true,
    updateHour: 3,
    fuse: false,
    serviceUser: false,
    asService: false,
    adminOn: false,
    browser: true,
    tPlayers: 16,
    tTeamSize: 1,
    tArenas: [],
    tPairing: 'first',
    tTeamsText: '',
    webhook: ''
  };

  let state = Object.assign({}, defaults);

  try {
    Object.assign(state, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  }
  catch (e) {}

  function field(label, input, opts) {
    const help = opts && opts.help ? ` <span class="gen-help" tabindex="0" title="${opts.help}">(?)</span>` : '';
    const l = el('label', { html: label + (opts && opts.hint ? ` <small>${opts.hint}</small>` : '') + help });
    return el('div', { class: 'gen-field' + (opts && opts.wide ? ' wide' : '') }, [l, input]);
  }

  function textInput(key, placeholder) {
    const i = el('input', { type: 'text', placeholder: placeholder || '' });
    i.value = state[key];
    i.addEventListener('input', () => { state[key] = i.value; update(); });
    return i;
  }

  // ports are typed, not clicked through: no spinner on them
  function numberInput(key, min, max, spinner = true) {
    const i = el('input', { type: 'number', min: String(min), max: String(max), class: spinner ? '' : 'no-spin' });
    i.value = state[key];
    i.addEventListener('input', () => {
      const v = parseInt(i.value, 10);
      state[key] = isNaN(v) ? defaults[key] : Math.max(min, Math.min(max, v));
      update();
    });
    return i;
  }

  function autoupdateInput() {
    const check = el('input', { type: 'checkbox' });
    check.checked = state.autoupdate;

    const hour = el('select', { class: 'gen-hour' });

    for (let h = 0; h < 24; ++h) {
      hour.appendChild(el('option', { value: String(h), text: `${String(h).padStart(2, '0')}:00` }));
    }

    hour.value = String(state.updateHour);

    const sync = () => { hour.disabled = !check.checked; };
    check.addEventListener('change', () => { state.autoupdate = check.checked; sync(); update(); });
    hour.addEventListener('change', () => { state.updateHour = parseInt(hour.value, 10); update(); });
    sync();

    return el('div', { class: 'gen-cycle gen-autoupdate' }, [
      el('label', {}, [check, document.createTextNode('Update every day at')]),
      hour,
      el('span', { class: 'gen-tz-note', text: "(the machine's time)" })
    ]);
  }

  // a text box that suggests the matching time zones as you type (a datalist - the browser filters it)
  /*
    The AppImage only: with FUSE it mounts itself, without it --appimage-extract-and-run unpacks it to /tmp at every start.
  */

  function fuseInput() {
    const check = el('input', { type: 'checkbox' });
    check.checked = state.fuse;
    check.addEventListener('change', () => { state.fuse = check.checked; update(); });

    return el('div', { class: 'gen-cycle gen-autoupdate' }, [
      el('label', {}, [check, document.createTextNode('FUSE is installed on this machine')]),
      el('span', { class: 'gen-tz-note', text: '(fuse / libfuse2 - fuse2 on Arch)' })
    ]);
  }

  const updatesField = field('Updates', autoupdateInput(), {
    wide: true,
    help: 'Players with a newer version cannot join an older server. Every day at this hour the server restarts if a new version is out - or keep it up to date yourself.',
    hint: '<a href="/host#updates">about updates</a>'
  });

  const timeZoneField = field('Time zone', timeZoneSelect(), {
    help: 'Where the server is. Players in the browser see from it roughly how far the server is, and official ranked servers have their happy hours (2x MMR) in it. Empty: the time zone of the machine - often UTC on a VPS.'
  });

  const fuseField = field('AppImage', fuseInput(), {
    wide: true,
    help: 'Without FUSE the AppImage needs --appimage-extract-and-run - it then unpacks itself to /tmp at every start. With FUSE it runs as it is.'
  });

  function timeZoneSelect() {
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    const list = el('datalist', { id: 'gen-time-zones' }, zones.map(z => el('option', { value: z })));
    const i = el('input', { type: 'text', list: 'gen-time-zones', placeholder: "empty: the machine's own - type e.g. Berlin" });

    i.value = state.timeZone;

    const check = () => {
      const v = i.value.trim();
      i.classList.toggle('gen-invalid', v !== '' && zones.length > 0 && !zones.includes(v));
      state.timeZone = v;
      update();
    };

    i.addEventListener('input', check);
    return el('div', {}, [i, list]);
  }

  // in the order they're checked - the number next to each is its place in the cycle
  function cyclePicker() {
    const box = el('div', { class: 'gen-cycle' });
    const all = arenas.official.map(n => [n, true]).concat(arenas.community.map(n => [n, false]));
    const labels = [];

    function renumber() {
      labels.forEach(l => {
        const i = state.cycle.indexOf(l.dataset.arena);
        l.lastChild.textContent = i >= 0 ? String(i + 1) : '';
      });
    }

    all.forEach(([name, official]) => {
      const c = el('input', { type: 'checkbox' });
      c.checked = state.cycle.includes(name);
      c.addEventListener('change', () => {
        state.cycle = c.checked ? state.cycle.concat([name]) : state.cycle.filter(n => n !== name);
        renumber();
        update();
      });

      const label = el('label', { class: official ? 'official' : '' }, [c, document.createTextNode(name), el('span', { class: 'gen-stage-no' })]);
      label.dataset.arena = name;
      labels.push(label);
      box.appendChild(label);
    });

    renumber();
    return box;
  }


  /*
    The first server's ports are typed; the ones after them are only shown, one row per server, with what takes them.
  */

  const portNote = el('span', { class: 'gen-port-note' });
  const morePorts = el('div', { class: 'gen-more-ports' });

  // players in the browser (play.hypersomnia.io) - on by default; off, no browser ports anywhere
  const webPortInput = numberInput('webPort', 1024, 65000, false);
  const browserCheck = el('input', { type: 'checkbox' });
  browserCheck.checked = state.browser;
  browserCheck.addEventListener('change', () => { state.browser = browserCheck.checked; update(); });

  const browserOption = el('div', { class: 'gen-cycle gen-autoupdate gen-browser-option' }, [
    el('label', {}, [browserCheck, document.createTextNode('Allow browser players')]),
    el('span', { class: 'gen-tz-note', html: '(<a href="https://play.hypersomnia.io" target="_blank">play.hypersomnia.io</a> - they need the browser ports)' })
  ]);

  // the columns named once, over the first server's row and the range of the others
  const portRows = el('div', {}, [
    el('div', { class: 'gen-port-row gen-port-head' }, [
      el('span', { html: '<i class="fa-solid fa-gamepad"></i>Game <small>UDP</small>' }),
      el('span', { html: '<i class="fa-solid fa-globe"></i>Browser <small>UDP</small>' }),
      el('span')
    ]),
    el('div', { class: 'gen-port-row' }, [numberInput('port', 1024, 65000, false), webPortInput, portNote]),
    morePorts,
    browserOption
  ]);

  // a tournament opens a server per match and lets in only its players instead
  const casualInput = numberInput('casual', 1, 16);
  const slotsInput = numberInput('slots', 2, 64);



  /*
    Always two rows, so nothing below jumps: the first server's ports, then the rest of them as one range.
  */

  const restGame = el('input', { type: 'text', disabled: 'disabled' });
  const restWeb = el('input', { type: 'text', disabled: 'disabled' });
  const restNote = el('span', { class: 'gen-port-note' });
  const restRow = el('div', { class: 'gen-port-row' }, [restGame, restWeb, restNote]);
  morePorts.appendChild(restRow);

  function updatePortRows() {
    rebuildRounds();

    const n = instanceCount();
    const kind = isTournament() ? 'Tournament match' : 'Server';
    const kinds = isTournament() ? 'Tournament matches' : 'Servers';
    const range = first => n === 2 ? `${first + 1}` : `${first + 1}-${first + n - 1}`;

    [nameField, cycleField, adminField, adminWarningField, slotsField, serversField, updatesField, timeZoneField].forEach(f => { f.hidden = isTournament(); });

    // no browser players, no browser column
    portRows.classList.toggle('no-browser', !state.browser);

    // the rest of the ports in one row - only when there is more than one server
    portNote.textContent = n > 1 ? `${kind} 1` : 'The server';
    restRow.hidden = n < 2;

    if (n > 1) {
      restGame.value = range(state.port);
      restWeb.value = state.browser ? range(state.webPort) : '-';
      restNote.textContent = n === 2 ? `${kind} 2` : `${kinds} 2-${n}`;
    }
  }


  const cycleBox = cyclePicker();
  // the first checked arena is the one the server starts with
  const cycleField = field('Map cycle', cycleBox, {
    wide: true,
    hint: '<a href="/arenas" target="_blank">(browse)</a> the first one checked starts - none checked: de_cyberaqua'
  });

  const admins = el('textarea', { rows: '2', placeholder: 'steam_76561198000000000\n0x8aed41f2...' });
  admins.value = state.admins;
  admins.addEventListener('input', () => { state.admins = admins.value; update(); });

  const adminWarning = el('div', { class: 'gen-hint' });

  // off by default - the box for the ids only when it's on
  const adminCheck = el('input', { type: 'checkbox' });
  adminCheck.checked = state.adminOn;

  // one box: the checkbox, the ids when it's on, and what it is for under them
  const adminBox = el('div', { class: 'gen-cycle gen-admin-box' }, [
    el('div', { class: 'gen-admin-head' }, [
      el('label', {}, [adminCheck, document.createTextNode('Admin account id')]),
      el('span', { class: 'gen-tz-note', html: '<a href="/host#become-an-admin">where to get it?</a>' })
    ]),
    admins,
    el('p', { class: 'gen-field-text', text: 'This lets you manage your server in-game (change maps, bans etc).' })
  ]);

  function updateAdmins() {
    admins.hidden = !state.adminOn;
  }

  adminCheck.addEventListener('change', () => { state.adminOn = adminCheck.checked; updateAdmins(); update(); });
  updateAdmins();

  const adminField = el('div', { class: 'gen-field wide' }, [adminBox]);

  const adminWarningField = el('div', { class: 'gen-field wide' }, [adminWarning]);

  // under the tournament's button: what the tournament manages for itself when it's on
  const slotsField = field('Slots', slotsInput);
  const serversField = field('Server instances', casualInput, { help: 'If hosting multiple instances, they will take subsequent ports.' });

  /*
    The name and the ports first - the ports stay in place with a tournament, showing its match servers.
    What a tournament decides by itself (and the admins - a tournament is a one-off) is hidden while it's on.
  */

  // a tournament names its match servers by itself: Match #1 (any pair), then by the players
  const nameField = field('Server name', textInput('name', 'My server'), { wide: true });

  const form = el('div', { class: 'gen-form' }, [
    nameField,
    cycleField,
    slotsField,
    serversField,
    field('Ports', portRows, {
      wide: true,
      help: 'Only if 8412 or 9000 is taken on this machine. Several servers take the next ports after these.'
    }),
    field('Server password', textInput('password', 'none - anyone can join'), { wide: true }),
    adminField,
    adminWarningField
  ]);

  const serversForm = el('div', { class: 'gen-form gen-servers' });

  /*
    Rarely needed - behind one button, open if anything in it is set.
  */

  const advanced = el('div', { class: 'gen-form gen-advanced' }, [
    updatesField,
    fuseField,
    timeZoneField,
    field('Discord webhook', textInput('webhook', 'optional - posts joins and match results'), { wide: true })
  ]);

  const advancedSet = () =>
    state.timeZone !== '' || state.webhook !== '' ||
    !state.autoupdate || state.updateHour !== 3 || state.fuse
  ;
  let advancedOpen = advancedSet();
  const advancedButton = el('button', { type: 'button' });

  function showAdvanced(open) {
    advancedOpen = open;
    advanced.hidden = !open;
    advancedButton.textContent = 'Show advanced options';
    advancedButton.classList.toggle('active', open);
  }

  advancedButton.addEventListener('click', () => showAdvanced(!advancedOpen));
  showAdvanced(advancedOpen);

  const advancedToggle = el('div', { class: 'btn-group gen-advanced-toggle' }, [el('div', { class: 'btn' }, [advancedButton])]);

  /*
    A tournament instead of the usual servers - behind its own button, with a trophy so it stands out.
  */

  /*
    A dropdown per bracket round - as many as the players make (16 players 1v1: 4 rounds), by default
    de_cyberaqua and de_silo by turns.
  */

  // "Set up beforehand": one team per line, its players separated by commas
  function listedTeams() {
    return state.tTeamsText.split('\n')
      .map(line => line.split(',').map(n => n.trim()).filter(Boolean))
      .filter(team => team.length > 0);
  }

  const pairedBeforehand = () => isTournament() && state.tPairing === 'beforehand';

  function teamCount() {
    return pairedBeforehand() ? listedTeams().length : Math.ceil(state.tPlayers / state.tTeamSize);
  }

  function bracketRounds() {
    const teams = teamCount();
    return Math.max(1, Math.ceil(Math.log2(Math.max(2, teams))));
  }

  function roundName(i, rounds) {
    const fromEnd = rounds - 1 - i;
    return ['Final', 'Semifinals', 'Quarterfinals'][fromEnd] || `Round ${i + 1}`;
  }

  const roundsBox = el('div', { class: 'gen-rounds' });
  let shownRounds = 0;

  function roundMaps() {
    const rounds = bracketRounds();
    const out = state.tArenas.slice(0, rounds);

    while (out.length < rounds) {
      out.push(out.length % 2 === 0 ? 'de_cyberaqua' : 'de_silo');
    }

    return out;
  }

  function rebuildRounds() {
    const rounds = bracketRounds();

    if (rounds === shownRounds) {
      return;
    }

    shownRounds = rounds;
    state.tArenas = roundMaps();
    roundsBox.innerHTML = '';

    state.tArenas.forEach((name, i) => {
      const s = el('select');
      const group = (label, names) => el('optgroup', { label }, names.map(n => el('option', { value: n, text: n })));
      s.appendChild(group('Official', arenas.official));
      s.appendChild(group('Community', arenas.community));
      s.value = name;
      s.addEventListener('change', () => { state.tArenas[i] = s.value; update(); });

      const named = rounds - 1 - i < 3;
      roundsBox.appendChild(el('div', { class: 'gen-round' }, [el('span', { class: 'gen-round-name' + (named ? ' named' : ''), text: roundName(i, rounds) }), s]));
    });
  }


  function teamSizeSelect() {
    const s = el('select', {}, [1, 2, 3, 4, 5].map(n => el('option', { value: String(n), text: `${n}v${n}` })));
    s.value = String(state.tTeamSize);
    s.addEventListener('change', () => { state.tTeamSize = parseInt(s.value, 10); update(); });
    return s;
  }

  /*
    Player pairings: by who joins first (nothing to prepare), or the teams and who plays whom written beforehand.
  */

  const PAIRING_TEXT = {
    first: 'Players join <strong>any server</strong> they want <em>in the first round</em>.<br>They can use <strong>any nicknames</strong> they like.<br>In later rounds, they will be paired automatically.',
    // made by the size of the teams - see beforehandText()
    beforehand: ''
  };

  // four example teams of the chosen size: alice / bob / ... or "alice, bob, carol" per line
  function examplePlayers() {
    const names = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'gus', 'hal', 'ivy', 'jo', 'kim', 'leo', 'mia', 'ned', 'oli', 'pat', 'quin', 'rex', 'sam', 'tom'];
    const lines = [];

    for (let t = 0; t < 4; ++t) {
      lines.push(names.slice(t * state.tTeamSize, (t + 1) * state.tTeamSize).join(', '));
    }

    return lines.join('\n');
  }

  function beforehandText() {
    const how = state.tTeamSize === 1
      ? 'One player per line.'
      : `One team per line, its ${state.tTeamSize} players separated by commas.`;

    return `${how} Lines 1 and 2 play each other, 3 and 4, and so on - unless the teams aren't 2, 4, 8, 16...: then the first lines advance without playing.<br>Every match server lets in only its players - players set these exact nicknames to be let in.`;
  }

  // how the list was understood: the pairs of round 1, the byes first - a mistyped team shows at once
  const pairingPreview = el('p', { class: 'gen-field-text gen-pairing-preview' });

  function updatePairingPreview() {
    const teams = listedTeams();
    const name = t => `[${t.join(', ')}]`;
    const wrong = teams.filter(t => t.length !== state.tTeamSize);

    if (teams.length < 2) {
      pairingPreview.innerHTML = '';
      return;
    }

    let size = 1;

    while (size < teams.length) {
      size *= 2;
    }

    const byes = size - teams.length;
    const lines = [];

    for (let i = byes; i + 1 < teams.length; i += 2) {
      lines.push(`${name(teams[i])} vs ${name(teams[i + 1])}`);
    }

    const advance = teams.slice(0, byes).map(name);

    pairingPreview.innerHTML =
      `<strong>Round 1:</strong> ${lines.join(' &middot; ')}` +
      (advance.length ? `<br><strong>Byes:</strong> ${advance.join(', ')}` : '') +
      (wrong.length ? `<br><span class="gen-bad">Not ${state.tTeamSize} ${state.tTeamSize > 1 ? 'players' : 'player'}: ${wrong.map(name).join(', ')}</span>` : '');
  }

  const pairingSelect = el('select', {}, [
    el('option', { value: 'first', text: 'However they join first' }),
    el('option', { value: 'beforehand', text: 'Set up beforehand' })
  ]);

  const pairingText = el('p', { class: 'gen-field-text' });
  const teamsText = el('textarea', { rows: '4', placeholder: 'alice\nbob\ncarol\ndave' });

  pairingSelect.value = state.tPairing;
  teamsText.value = state.tTeamsText;

  pairingSelect.addEventListener('change', () => { state.tPairing = pairingSelect.value; update(); });
  teamsText.addEventListener('input', () => { state.tTeamsText = teamsText.value; update(); });

  const playersInput = numberInput('tPlayers', 2, 128);
  const teamSize = teamSizeSelect();
  const playersField = field('Players', playersInput, { help: 'How many players come.' });
  const teamsField = field('Teams', teamSize);

  function updatePairing() {
    const beforehand = state.tPairing === 'beforehand';

    pairingText.innerHTML = beforehand ? beforehandText() : PAIRING_TEXT.first;
    teamsText.hidden = !beforehand;
    pairingPreview.hidden = !beforehand;
    teamsText.placeholder = examplePlayers();

    if (beforehand) {
      updatePairingPreview();
    }

    // the list decides how many come - the size of the teams still says how to write it
    playersField.hidden = beforehand;
  }

  const roundSummary = el('p', { class: 'gen-field-text' });

  const tournamentForm = el('div', { class: 'gen-form gen-advanced' }, [
    // the size of the teams first - it says how to write the list below
    teamsField,
    field('Player pairings', el('div', {}, [pairingSelect, pairingText, teamsText, pairingPreview]), { wide: true }),
    playersField,
    el('div', { class: 'gen-field wide' }, [roundSummary]),
    field('Maps for each bracket round', roundsBox, { wide: true })
  ]);

  // shown on the Tournament tab
  function updateTournamentForm() {
    tournamentForm.hidden = !isTournament();
  }

  // what the generator gives for each setup, then the firewall
  // the generator's results for each setup - the firewall's always last
  const OUTPUTS = {
    compose: ['compose', 'firewall'],
    run: ['run', 'firewall'],
    terminal: ['json', 'firewall'],
    service: ['json', 'service', 'firewall']
  };

  const OUTPUT_NAMES = {
    compose: 'docker-compose.yaml',
    run: 'docker run',
    json: 'conf.d/server.json',
    service: 'hypersomnia.service',
    firewall: 'Firewall'
  };

  const outputsOf = () => OUTPUTS[method()].slice();

  let shownOutput = 'compose';

  const hint = el('p', { class: 'gen-hint' });
  const code = el('code');
  const copy = el('button', { type: 'button', class: 'guide-copy', title: 'Copy', html: '<i class="fa-regular fa-copy"></i>' });
  /*
    Where the result goes, as the block's own first line - copyable apart from it, above a dashed line.
  */

  const filePath = el('code');
  const fileLine = el('div', { class: 'guide-code-file' }, [
    filePath,
    el('button', { type: 'button', class: 'gen-inline-copy', title: 'Copy the path', html: '<i class="fa-regular fa-copy"></i>' })
  ]);

  const codeBox = el('div', { class: 'guide-code' }, [fileLine, copy, el('pre', {}, [code])]);

  // unneeded: the file's path struck through, grey, nothing to copy
  function setFile(path, unneeded = false) {
    filePath.textContent = path || '';
    fileLine.hidden = !path;
    codeBox.classList.toggle('with-file', !!path);
    codeBox.classList.toggle('unneeded', unneeded);
  }

  /*
    How to start the server with this config - always shown under the results (not for docker run: that is the command).
  */

  const startCode = el('code');
  const startBlock = el('div', { class: 'gen-start-box' }, [
    el('div', { class: 'gen-start-label', text: 'Start the server with:' }),
    el('div', { class: 'guide-code gen-start-code' }, [
      el('button', { type: 'button', class: 'guide-copy', title: 'Copy', html: '<i class="fa-regular fa-copy"></i>' }),
      el('pre', {}, [startCode])
    ])
  ]);

  // what to do with the result goes under it
  const output = el('div', { class: 'gen-output' }, [codeBox, hint]);

  // its own outlined box under the generator, like a second one with only the command
  mount.after(startBlock);

  /*
    Check that it works: what the players should see, for a server or a tournament - only on /generator,
    the guide has its own section.
  */

  const checkText = el('p', { class: 'gen-field-text' });
  const checkImage = el('img', { class: 'guide-image', alt: '' });

  const checkBlock = el('div', { class: 'gen-start-box gen-check-box' }, [
    el('div', { class: 'gen-start-label', text: 'Check that it works:' }),
    checkText,
    checkImage
  ]);

  if (setupSections.length === 0) {
    startBlock.after(checkBlock);
  }

  function updateCheck() {
    if (isTournament() && state.tPairing === 'beforehand') {
      checkText.innerHTML = 'Players on your network see every match under <strong>Ongoing Tournament</strong> in <code>Browse servers</code>.<br>Players must join the server that mentions their team/nickname:';
      checkImage.src = '/host/asset/docs/images/server_browser_tournament.png?ref=release';
      checkImage.alt = 'The tournament\'s matches in Browse servers';
    }
    else if (isTournament()) {
      checkText.innerHTML = 'Players on your network see every match under <strong>Ongoing Tournament</strong> in <code>Browse servers</code>.<br>Until it is full, a match says <code>(any pair)</code> - anyone may join it.<br>Then it is named by its players:';
      checkImage.src = '/host/asset/docs/images/server_browser_tournament_open.png?ref=release';
      checkImage.alt = 'The tournament\'s matches in Browse servers';
    }
    else {
      checkText.innerHTML = 'Within a minute your server is on <a href="/servers" target="_blank">hypersomnia.io/servers</a> and in <code>Browse servers</code> in the game.<br>On the list but nobody can join?<br>Open the ports - see the <code>Firewall</code> tab above.';
      checkImage.src = '/host/asset/docs/images/server_browser.png?ref=release';
      checkImage.alt = 'Your server in Browse servers';
    }
  }

  /*
    What to do once before the config - the same steps as the guide's for that setup.
  */

  const BEFORE = {
    terminal: 'wget https://hypersomnia.io/builds/latest/Hypersomnia-Headless.AppImage\nchmod +x Hypersomnia-Headless.AppImage',
    service: 'cd ~\nwget https://hypersomnia.io/builds/latest/Hypersomnia-Headless.AppImage\nchmod +x Hypersomnia-Headless.AppImage\nmkdir -p ~/.config/systemd/user',
    // the same, the server running as its own user
    serviceUser: 'sudo useradd --system --create-home --home-dir /opt/hypersomnia hypersomnia\ncd /opt/hypersomnia\nsudo -u hypersomnia wget https://hypersomnia.io/builds/latest/Hypersomnia-Headless.AppImage\nsudo chmod +x Hypersomnia-Headless.AppImage',
    compose: 'sudo mkdir /opt/hypersomnia\nsudo chown 999:999 /opt/hypersomnia',
    run: 'sudo mkdir /opt/hypersomnia\nsudo chown 999:999 /opt/hypersomnia'
  };

  const beforeCode = el('code');

  // the service only: as root (a VPS of its own) or as a separate user
  const userCheck = el('input', { type: 'checkbox' });
  userCheck.checked = state.serviceUser;
  userCheck.addEventListener('change', () => { state.serviceUser = userCheck.checked; updateBefore(); update(); });

  const serviceCheck = el('input', { type: 'checkbox' });
  serviceCheck.checked = state.asService;
  serviceCheck.addEventListener('change', () => {
    state.asService = serviceCheck.checked;
    setupListeners.forEach(f => f(currentSetup));
  });

  const serviceOption = el('div', { class: 'gen-cycle gen-autoupdate gen-user-option' }, [
    el('label', {}, [serviceCheck, document.createTextNode('Run as a service')]),
    el('span', { class: 'gen-tz-note', text: '(systemd - starts with the machine, runs without a terminal)' })
  ]);

  const userOption = el('div', { class: 'gen-cycle gen-autoupdate gen-user-option' }, [
    el('label', {}, [userCheck, document.createTextNode('Run as a separate user')]),
    el('span', { class: 'gen-tz-note', text: '(hypersomnia, everything in /opt/hypersomnia)' })
  ]);

  const beforeBlock = el('div', { class: 'gen-start-box gen-before-box' }, [
    el('div', { class: 'gen-start-label', text: 'Before you start:' }),
    serviceOption,
    userOption,
    el('div', { class: 'guide-code gen-start-code' }, [
      el('button', { type: 'button', class: 'guide-copy', title: 'Copy', html: '<i class="fa-regular fa-copy"></i>' }),
      el('pre', {}, [beforeCode])
    ])
  ]);

  // only on /generator - the guide has these steps in its own sections
  const standalone = setupSections.length === 0;

  if (standalone) {
    mount.before(beforeBlock);
  }

  function updateFuseField() {
    fuseField.hidden = method() === 'compose' || method() === 'run';
  }

  function beforeText() {
    const key = method() === 'service' && state.serviceUser ? 'serviceUser' : method();
    return BEFORE[key] || '';
  }

  function updateBefore() {
    serviceOption.hidden = currentSetup !== 'server-appimage';
    userOption.hidden = method() !== 'service';
    beforeCode.textContent = beforeText();
    beforeBlock.hidden = !BEFORE[method()];
    highlight(beforeCode, 'bash');
  }
  let outputButtons = null;
  let shownKinds = '';

  function rebuildOutputButtons() {
    const kinds = outputsOf();
    const group = buttonGroup(kinds.map(k => OUTPUT_NAMES[k]), i => { shownOutput = kinds[i]; update(); });
    shownKinds = kinds.join();

    if (outputButtons) {
      outputButtons.replaceWith(group);
    }
    else {
      output.prepend(group);
    }

    outputButtons = group;
    shownOutput = kinds[0];
  }

  rebuildOutputButtons();
  setupListeners.push(() => { rebuildOutputButtons(); update(); });

  /*
    Not a login form: keep password managers (LastPass, 1Password, Bitwarden...) and autofill out of it -
    they jump at the "Password" field and the fields next to it.
  */
  [form, serversForm, advanced, tournamentForm].forEach(f => f.querySelectorAll('input, textarea').forEach(i => {
    i.setAttribute('autocomplete', 'off');
    i.setAttribute('data-lpignore', 'true');
    i.setAttribute('data-1p-ignore', 'true');
    i.setAttribute('data-bwignore', 'true');
    i.setAttribute('data-form-type', 'other');
  }));

  const formRoot = el('form', { autocomplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-bwignore': 'true' }, [tournamentForm, form, serversForm, advancedToggle, advanced]);
  formRoot.addEventListener('submit', e => e.preventDefault());
  mount.appendChild(formRoot);
  mount.appendChild(output);

  const ACCOUNT_ID = /^(steam_\d{17}|0x[0-9a-f]{64}|key_[0-9a-f]{64}|crazygames_\S+)$/i;

  function adminIds() {
    if (!state.adminOn) {
      return [];
    }

    return state.admins.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  }

  /*
    The bracket as the game makes it (tournament_coordinator.cpp): the teams padded to a power of two,
    the padding as byes in the first round - those teams advance without playing, no server for them.
    A server per match, so the ports are for the round with the most matches: the first, or the second
    when byes leave the first with fewer.
  */

  function tournamentBracket() {
    const teams = Math.max(2, teamCount());
    let size = 1;

    while (size < teams) {
      size *= 2;
    }

    const byes = size - teams;
    const firstRound = (teams - byes) / 2;
    const secondRound = size / 4;

    return { teams, byes, firstRound, servers: Math.max(1, firstRound, secondRound) };
  }

  function tournamentMatches() {
    return tournamentBracket().servers;
  }

  // only casual servers for now - a ranked one counts on the leaderboards only when official
  function instanceCount() {
    return isTournament() ? tournamentMatches() : Math.max(1, state.casual);
  }

  // the tournament as command line flags (the AppImage) or environment variables (Docker)
  function tournamentFlags() {
    const quoted = v => /[\s;"']/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
    const out = [];

    if (pairedBeforehand()) {
      // the teams in one argument: "alice, bob; carol, dave"
      out.push(`--tournament-teams ${quoted(listedTeams().map(t => t.join(', ')).join('; '))}`);
    }
    else {
      out.push(`--tournament ${state.tPlayers}`);

      if (state.tTeamSize > 1) {
        out.push(`--tournament-team-size ${state.tTeamSize}`);
      }
    }

    if (isTournament()) {
      const list = roundMaps().map(withMode).join(',');
      out.push(`--tournament-arenas ${list.includes(' ') ? `"${list}"` : list}`);
    }

    return out.join(' ');
  }

  function portSpan(first) {
    const last = first + instanceCount() - 1;
    return last === first ? `${first}` : `${first}-${last}`;
  }

  /*
    The settings as environment variables (Docker) where one exists - the rest as JSON.
    For the AppImage everything is JSON, for conf.d/.
  */
  // arenas whose own default is not bomb defusal - the generator offers bomb defusal only
  const NOT_BOMB_BY_DEFAULT = ['hyperactive_space_station', 'fy_iceworld'];
  const withMode = n => NOT_BOMB_BY_DEFAULT.includes(n) ? `${n} bomb_defusal` : n;

  // the AppImage's conf.d/server.json
  // the server starts with the first arena of its cycle; a cycle of one is just that arena
  const startArena = () => state.cycle[0] || 'de_cyberaqua';
  const cycleOn = () => state.cycle.length > 1 && !isTournament();

  function buildSettings() {
    const mode = NOT_BOMB_BY_DEFAULT.includes(startArena()) ? 'bomb_defusal' : '';
    const ids = adminIds();

    const server = {};
    const config = {};
    const priv = {};

    if (!isTournament()) {
      server.server_name = state.name || 'My server';
    }

    if (!isTournament()) {
      server.arena = startArena();
    }

    if (mode && !isTournament()) {
      server.game_mode = mode;
    }

    if (ids.length && !isTournament()) {
      priv.admin_profiles = ids.map(account => ({ account, rcon: 'MASTER_RCON' }));
    }

    if (state.password) {
      priv.server_password = state.password;
    }

    if (!isTournament() && state.casual !== 1) {
      config.instances = { casual: state.casual };
    }

    // a tournament plays its own arenas, round by round
    if (cycleOn()) {
      server.cycle = 'LIST';
      server.cycle_list = state.cycle.map(withMode);
    }

    if (!state.browser) {
      server.allow_webrtc_clients = false;
    }
    else if (state.webPort !== 9000) {
      server.webrtc_port_range_begin = state.webPort;
    }

    if (state.timeZone && !isTournament()) {
      server.time_zone = state.timeZone;
    }

    /*
      Daily updates: by the --daily-autoupdate flag in the start command or the service - only another hour goes here.
    */

    if (updatesOn() && state.updateHour !== 3) {
      server.daily_autoupdate_hour = state.updateHour;
    }

    if (state.webhook) {
      priv.discord_webhook_url = state.webhook;
    }

    const json = {};

    const slotsSet = !isTournament() && state.slots !== 16;

    if (state.port !== 8412 || slotsSet) {
      json.server_start = {};

      if (state.port !== 8412) {
        json.server_start.port = state.port;
      }

      if (slotsSet) {
        json.server_start.slots = state.slots;
      }
    }

    if (Object.keys(server).length) {
      json.server = server;
    }

    if (Object.keys(priv).length) {
      json.server_private = priv;
    }

    Object.assign(json, config);

    return { json: Object.keys(json).length ? json : null };
  }

  /*
    Docker: every field of the generator as its own environment variable - never a file, never HYPERSOMNIA_CONFIG.
    Only what differs from the defaults is written.
  */

  function dockerEnv() {
    const env = isTournament() ? [] : [['HYPERSOMNIA_SERVER_NAME', state.name || 'My server']];
    const ids = adminIds();
    const put = (k, v) => env.push([k, v]);

    if (!isTournament() && startArena() !== 'de_cyberaqua') {
      put('HYPERSOMNIA_ARENA', withMode(startArena()));
    }

    if (cycleOn()) {
      put('HYPERSOMNIA_MAP_CYCLE', state.cycle.map(withMode).join(','));
    }

    if (ids.length && !isTournament()) {
      put('HYPERSOMNIA_ADMINS', ids.join(','));
    }

    if (state.password) {
      put('HYPERSOMNIA_PASSWORD', state.password);
    }

    if (!isTournament() && state.slots !== 16) {
      put('HYPERSOMNIA_SLOTS', String(state.slots));
    }

    if (!isTournament() && state.casual !== 1) {
      put('HYPERSOMNIA_SERVER_INSTANCES', String(state.casual));
    }

    if (state.port !== 8412) {
      put('HYPERSOMNIA_PORT', String(state.port));
    }

    if (!state.browser) {
      put('HYPERSOMNIA_BROWSER_PLAYERS', 'off');
    }
    else if (state.webPort !== 9000) {
      put('HYPERSOMNIA_WEB_PORT', String(state.webPort));
    }

    if (!updatesOn()) {
      put('HYPERSOMNIA_DAILY_UPDATE', 'off');
    }
    else if (state.updateHour !== 3) {
      put('HYPERSOMNIA_DAILY_UPDATE', `${String(state.updateHour).padStart(2, '0')}:00`);
    }

    if (state.timeZone && !isTournament()) {
      put('HYPERSOMNIA_TIME_ZONE', state.timeZone);
    }

    if (state.webhook) {
      put('HYPERSOMNIA_DISCORD_WEBHOOK', state.webhook);
    }

    if (pairedBeforehand()) {
      // a team per line, its players separated by commas
      put('HYPERSOMNIA_TOURNAMENT_TEAMS', listedTeams().map(t => t.join(', ')).join('\n'));
      put('HYPERSOMNIA_TOURNAMENT_ARENAS', roundMaps().map(withMode).join(','));
    }
    else if (isTournament()) {
      put('HYPERSOMNIA_TOURNAMENT', String(state.tPlayers));

      if (state.tTeamSize > 1) {
        put('HYPERSOMNIA_TOURNAMENT_TEAM_SIZE', String(state.tTeamSize));
      }

      put('HYPERSOMNIA_TOURNAMENT_ARENAS', roundMaps().map(withMode).join(','));
    }

    return env;
  }

  /* one admin profile per line, like people write it by hand */
  function prettyJson(value) {
    return JSON.stringify(value, null, 2)
      .replace(
        /\{\n\s+"account": ("[^"]*"),\n\s+"rcon": ("[^"]*")\n\s+\}/g,
        '{ "account": $1, "rcon": $2 }'
      )
      // a short list of names on one line, e.g. a team: [ "alice", "bob" ]
      .replace(/\[\n\s+("[^"\n]*"(?:,\n\s+"[^"\n]*")*)\n\s+\]/g, (whole, items) => {
        const line = '[ ' + items.split(/,\n\s+/).join(', ') + ' ]';
        return line.length <= 72 ? line : whole;
      });
  }

  function compose() {
    const env = dockerEnv();
    const game = portSpan(state.port);
    const web = portSpan(state.webPort);

    const lines = [
      'services:',
      '  hypersomnia-server:',
      '    image: ghcr.io/teamhypersomnia/hypersomnia-server:latest',
      '    pull_policy: daily',
      '    restart: unless-stopped',
      '    volumes:',
      '      - /opt/hypersomnia:/home/hypersomniac/.config/Hypersomnia/user',
      '    ports:',
      `      - '${game}:${game}/udp'`,
      state.browser ? `      - '${web}:${web}/udp'` : null,
      '    environment:'
    ].filter(line => line !== null);

    env.forEach(([k, v]) => {
      if (v.includes('\n')) {
        lines.push(`      ${k}: |`);
        v.split('\n').forEach(l => lines.push('        ' + l));
      }
      else {
        lines.push(`      ${k}: ${JSON.stringify(v)}`);
      }
    });

    return lines.join('\n');
  }

  function dockerRun() {
    const env = dockerEnv();
    const quote = v => "'" + v.replace(/'/g, "'\\''") + "'";
    const game = portSpan(state.port);
    const web = portSpan(state.webPort);

    const lines = [
      'docker run -d --name hypersomnia-server',
      '  --restart unless-stopped',
      `  --publish ${game}:${game}/udp`,
      state.browser ? `  --publish ${web}:${web}/udp` : null,
      '  --volume /opt/hypersomnia:/home/hypersomniac/.config/Hypersomnia/user'
    ].filter(line => line !== null);

    // in one command the teams go on one line, separated by semicolons
    env.forEach(([k, v]) => lines.push(`  --env ${k}=${quote(v.replace(/\n/g, '; '))}`));

    lines.push('  ghcr.io/teamhypersomnia/hypersomnia-server:latest');
    return lines.map((l, i) => i < lines.length - 1 ? l + ' \\' : l).join('\n');
  }

  // a tournament never restarts in the middle of it to update
  const updatesOn = () => state.autoupdate && !isTournament();

  const extractFlag = () => state.fuse ? '' : ' --appimage-extract-and-run';

  function startCommand() {
    // a persistent server in a terminal updates itself by the flag, as the service does
    const daily = currentSetup === 'server-appimage' && updatesOn() ? ' --daily-autoupdate' : '';
    const flags = isTournament() ? ' ' + tournamentFlags() : '';
    return `./Hypersomnia-Headless.AppImage${extractFlag()}${daily}${flags}`;
  }

  /*
    The service: as yourself, a systemd user service next to the AppImage in your home folder (%h) - no paths, no sudo;
    or as a separate user, a system service in /opt/hypersomnia.
  */

  const ownUser = () => !state.serviceUser;

  function serviceUnit() {
    const flags = [
      '--as-service',
      updatesOn() ? '--daily-autoupdate' : '',
      ownUser() ? '' : '--appdata-dir /opt/hypersomnia',
      isTournament() ? tournamentFlags() : ''
    ].filter(Boolean).join(' ');

    const dir = ownUser() ? '%h' : '/opt/hypersomnia';

    return [
      '[Unit]',
      'Description=Hypersomnia dedicated server',
      ownUser() ? null : 'Wants=network-online.target',
      ownUser() ? null : 'After=network-online.target',
      '',
      '[Service]',
      ownUser() ? null : 'User=hypersomnia',
      `WorkingDirectory=${dir}`,
      `ExecStart=${dir}/Hypersomnia-Headless.AppImage${extractFlag()} \\`,
      `    ${flags}`,
      'Restart=always',
      'RestartSec=3',
      '',
      '[Install]',
      ownUser() ? 'WantedBy=default.target' : 'WantedBy=multi-user.target'
    ].filter(line => line !== null).join('\n');
  }


  function firewall() {
    const ufw = s => s.replace('-', ':');

    const web = state.browser;

    return [
      '# ufw (Ubuntu, Debian)',
      `sudo ufw allow ${ufw(portSpan(state.port))}/udp`,
      web ? `sudo ufw allow ${ufw(portSpan(state.webPort))}/udp` : null,
      '',
      '# firewalld (Fedora, RHEL)',
      `sudo firewall-cmd --permanent --add-port=${portSpan(state.port)}/udp`,
      web ? `sudo firewall-cmd --permanent --add-port=${portSpan(state.webPort)}/udp` : null,
      'sudo firewall-cmd --reload'
    ].filter(line => line !== null).join('\n');
  }

  // a path or a command in a hint: monospace with its own copy button
  function inline(text) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="gen-inline"><code>${escaped}</code><button type="button" class="gen-inline-copy" title="Copy"><i class="fa-regular fa-copy"></i></button></span>`;
  }

  // the tabs change with the pairings (tournament.json) - keep the shown one if it's still there
  function refreshOutputButtons() {
    if (outputsOf().join() === shownKinds) {
      return;
    }

    const was = shownOutput;
    rebuildOutputButtons();

    const kinds = outputsOf();

    if (kinds.includes(was)) {
      shownOutput = was;
      outputButtons.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', kinds[i] === was));
    }
  }

  function update() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    catch (e) {}

    const bad = adminIds().filter(id => !ACCOUNT_ID.test(id));
    adminWarning.textContent = bad.length
      ? `Not an account id: ${bad.join(', ')} - copy it from Settings → Account in the game (steam_ + 17 digits, or 0x + 64 characters).`
      : '';
    adminWarning.style.color = bad.length ? 'var(--red)' : '';
    adminWarning.style.display = bad.length ? '' : 'none';

    updateTournamentForm();
    updatePairing();
    updateCheck();
    refreshOutputButtons();
    updatePortRows();

    const n = instanceCount();
    const ports = state.browser ? `UDP ${portSpan(state.port)} and ${portSpan(state.webPort)}` : `UDP ${portSpan(state.port)}`;

    // what the ports are for - told in the Firewall tab
    const forWhat = isTournament() ? ' (one each per match server)' : n > 1 ? ' (one each per server)' : '';

    if (shownOutput === 'firewall') {
      hint.innerHTML = `Open ${ports}${forWhat} in the system firewall - and in your cloud provider's panel, if it has one.`;
      setFile('');
      code.textContent = firewall();
      highlight(code, 'bash');
    }
    else if (shownOutput === 'compose') {
      hint.innerHTML = 'Next to the data folder.';
      setFile('docker-compose.yaml');
      code.textContent = compose();
      highlight(code, 'yaml');
    }
    else if (shownOutput === 'run') {
      hint.innerHTML = `Run it instead of the command above (${inline('docker rm -f hypersomnia-server')} first, if it's running).`;
      setFile('');
      code.textContent = dockerRun();
      highlight(code, 'bash');
    }
    else if (shownOutput === 'service') {
      hint.innerHTML = 'The service that starts the server with the machine.';
      setFile(ownUser() ? '~/.config/systemd/user/hypersomnia.service' : '/etc/systemd/system/hypersomnia.service');
      code.textContent = serviceUnit();
      highlight(code, 'ini');
    }
    else {
      const service = method() === 'service';

      hint.innerHTML = '';

      const json = buildSettings().json;

      setFile(service && !ownUser() ? '/opt/hypersomnia/user/conf.d/server.json' : '~/.config/Hypersomnia/user/conf.d/server.json', !json);

      if (json) {
        code.textContent = prettyJson(json);
        highlight(code, 'json');
      }
      else {
        code.textContent = 'No server config required!';
        highlight(code, '');
      }
    }

    hint.hidden = !hint.innerHTML;

    // the tournament's round 1, under its own options
    const bracket = tournamentBracket();
    const byes = bracket.byes ? `, ${bracket.byes} ${bracket.byes > 1 ? 'byes' : 'bye'}` : '';
    // with the teams set up beforehand, their preview already shows round 1
    roundSummary.innerHTML = pairedBeforehand() ? '' : `<strong>Round 1:</strong> ${bracket.firstRound} ${bracket.firstRound > 1 ? 'matches' : 'match'}${byes}.`;

    const start = startText();

    startBlock.hidden = !start;
    fillStart(start);
  }

  function startText() {
    return {
      compose: 'docker compose up -d',
      terminal: startCommand(),
      service: ownUser()
        ? 'loginctl enable-linger\nsystemctl --user daemon-reload\nsystemctl --user enable hypersomnia\nsystemctl --user restart hypersomnia'
        : 'sudo systemctl daemon-reload\nsudo systemctl enable hypersomnia\nsudo systemctl restart hypersomnia'
    }[method()];
  }

  function fillStart(start) {
    /*
      Wrapped only between the arguments, never inside one (e.g. at the dash of --tournament-arenas):
      every argument unbreakable, the spaces between them as they are - copying gives the same text.
    */

    startCode.innerHTML = '';

    (start || '').split('\n').forEach((line, i) => {
      if (i > 0) {
        startCode.appendChild(document.createTextNode('\n'));
      }

      line.split(/( +)/).forEach(part => {
        startCode.appendChild(/^ +$/.test(part) || part === '' ? document.createTextNode(part) : el('span', { class: 'gen-arg', text: part }));
      });
    });
  }

  /*
    Profiles: the whole setup as a Markdown file - every step in order, ready to follow or to keep.
    Its last line is the generator's state in a comment (invisible when the file is shown), so it loads back exactly.
  */

  const PROFILE_MARK = 'hypersomnia-generator';

  function outputOf(kind) {
    const service = method() === 'service';

    return {
      compose: { title: 'docker-compose.yaml', lang: 'yaml', text: () => compose() },
      run: { title: 'Start it with docker run', lang: 'sh', text: () => dockerRun() },
      json: {
        title: service && !ownUser() ? '/opt/hypersomnia/user/conf.d/server.json' : '~/.config/Hypersomnia/user/conf.d/server.json',
        lang: 'json',
        text: () => prettyJson(buildSettings().json || {})
      },
      service: {
        title: ownUser() ? '~/.config/systemd/user/hypersomnia.service' : '/etc/systemd/system/hypersomnia.service',
        lang: 'ini',
        text: () => serviceUnit()
      },
      firewall: { title: 'Firewall', lang: 'sh', text: () => firewall() }
    }[kind];
  }

  function setupName() {
    const tab = document.querySelector('.guide-setup-tabs button.active');
    const sub = document.querySelector('.guide-setup-subtabs:not([hidden]) button.active');
    return [tab, sub].filter(Boolean).map(b => b.textContent.trim()).join(' - ');
  }

  /*
    Only what differs from the defaults - the defaults change, a loaded profile takes the new ones.
    The tournament's fields only for a tournament.
  */

  function changedFromDefaults() {
    const out = {};

    Object.keys(defaults).forEach(k => {
      const tournamentField = /^t[A-Z]/.test(k);

      if (tournamentField && !isTournament()) {
        return;
      }

      // the maps of the rounds by default go by turns - de_cyberaqua, de_silo...
      const fallback = k === 'tArenas' ? state.tArenas.map((_, i) => i % 2 === 0 ? 'de_cyberaqua' : 'de_silo') : defaults[k];

      if (JSON.stringify(state[k]) !== JSON.stringify(fallback)) {
        out[k] = state[k];
      }
    });

    return out;
  }

  function profileMarkdown() {
    const block = (title, lang, text) => `## ${title}\n\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    const parts = [`# ${isTournament() ? 'Hypersomnia tournament' : (state.name || 'My server')} - ${setupName()}\n`, 'Made with https://hypersomnia.io/generator\n'];

    if (beforeText()) {
      parts.push(block('Before you start', 'sh', beforeText()));
    }

    // the files first, the firewall after the start
    // a server.json of all defaults isn't needed - left out
    outputsOf().filter(k => k !== 'firewall' && !(k === 'json' && !buildSettings().json)).forEach(k => {
      const o = outputOf(k);
      parts.push(block(o.title, o.lang, o.text()));
    });

    if (startText()) {
      parts.push(block('Start the server', 'sh', startText()));
    }

    parts.push(block('Firewall', 'sh', firewall()));
    parts.push(`<!-- ${PROFILE_MARK} ${JSON.stringify({ setup: currentSetup, state: changedFromDefaults() })} -->\n`);

    return parts.join('\n');
  }

  function saveProfile() {
    const name = (isTournament() ? 'tournament' : (state.name || 'server')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'server';
    const blob = new Blob([profileMarkdown()], { type: 'text/markdown' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `hypersomnia-${name}.md` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // a saved profile replaces the form - through the browser's storage, then a reload builds everything anew
  function loadProfile(text) {
    const m = new RegExp(`<!--\\s*${PROFILE_MARK}\\s*([\\s\\S]*?)-->`).exec(text);

    if (!m) {
      alert('Not a profile saved by the generator - it has no "' + PROFILE_MARK + '" line at the end.');
      return;
    }

    try {
      const saved = JSON.parse(m[1]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.state || {}));

      if (saved.setup) {
        localStorage.setItem(SETUP_KEY, saved.setup);
      }

      location.reload();
    }
    catch (e) {
      alert('The profile could not be read: ' + e.message);
    }
  }

  function resetToDefaults() {
    if (!confirm('Reset every field of the generator to its default?')) {
      return;
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SETUP_KEY);
    }
    catch (e) {}

    location.reload();
  }

  const profileFile = el('input', { type: 'file', accept: '.md,text/markdown,text/plain', hidden: 'hidden' });

  profileFile.addEventListener('change', () => {
    const f = profileFile.files[0];

    if (f) {
      f.text().then(loadProfile);
    }

    profileFile.value = '';
  });

  const profileButton = (icon, text, onClick) => {
    const b = el('button', { type: 'button', html: `<i class="${icon}"></i>${text}` });
    b.addEventListener('click', onClick);
    return el('div', { class: 'btn' }, [b]);
  };

  const profileBar = el('div', { class: 'btn-group gen-profile-bar' }, [
    profileButton('fa-solid fa-download', 'Save profile', saveProfile),
    profileButton('fa-solid fa-upload', 'Load profile', () => profileFile.click()),
    profileButton('fa-solid fa-rotate-left', 'Reset to defaults', resetToDefaults),
    profileFile
  ]);

  // only on /generator, under everything
  if (setupSections.length === 0) {
    checkBlock.after(profileBar);
  }

  updateBefore();
  updateCheck();
  updateFuseField();
  setupListeners.push(updateCheck);
  setupListeners.push(updateBefore);
  setupListeners.push(updateFuseField);
  update();
})();
