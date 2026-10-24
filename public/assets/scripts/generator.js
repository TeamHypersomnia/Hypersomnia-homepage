/*
  /generator: the setup tabs, copy buttons and the config generator.
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

  /* ---------- setups: what the server is for (the tabs), then how it runs (each one's own tabs) ---------- */

  const SETUP_KEY = 'host_setup_v4';
  const tabButtons = Array.from(document.querySelectorAll('.guide-setup-tabs button'));

  // the setups as the tabs name them: a group's own tabs, or the group's tab itself when it has none

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
    The tabs are what the server is for (Persistent server, Tournament), their own tabs how it runs.
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

    try {
      localStorage.setItem(SETUP_KEY, id);
    }
    catch (e) {}

    setupListeners.forEach(f => f(id));
  }

  tabButtons.concat(subtabButtons).forEach(b => b.addEventListener('click', () => selectSetup(b.dataset.setup)));

  /*
    A profile in the link: /generator#p=<the settings that differ from the defaults, as base64url JSON> -
    without the secrets (passwords, webhooks, admins), which stay in the browser. Kept in the address bar as
    the settings change, so a bookmark is a profile.
  */

  const PROFILE_HASH = '#p=';
  const SECRET_KEYS = ['password', 'passwordOn', 'webhook', 'admins', 'adminOn'];

  // how this machine runs it is for whoever gets the link to decide - kept in their browser, as the secrets
  const MACHINE_KEYS = ['asService', 'serviceUser', 'fuse'];
  const NOT_IN_LINK = SECRET_KEYS.concat(MACHINE_KEYS);

  function encodeProfile(profile) {
    const bytes = new TextEncoder().encode(JSON.stringify(profile));
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeProfile(text) {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  const linkedProfile = (() => {
    if (!location.hash.startsWith(PROFILE_HASH)) {
      return null;
    }

    try {
      return decodeProfile(location.hash.slice(PROFILE_HASH.length));
    }
    catch (e) {
      return null;
    }
  })();

  // a link to a setup or its group (e.g. /generator#tournament) opens it; otherwise the last one chosen
  const linkedSetup = (() => {
    if (linkedProfile && setupIds.includes(linkedProfile.setup)) {
      return linkedProfile.setup;
    }

    const hash = decodeURIComponent(location.hash.slice(1));

    if (setupIds.includes(hash)) {
      return hash;
    }

    const groupTab = tabButtons.find(b => b.dataset.group === hash);
    return groupTab ? groupTab.dataset.setup : null;
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

  /* ---------- syntax colors (highlight.js, styled in generator.css with the site's colors) ---------- */

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

  /* ---------- config generator ---------- */

  const mount = document.getElementById('config-generator');

  if (!mount) {
    return;
  }

  const arenas = window.HOST_ARENAS || { official: ['de_cyberaqua'], community: [] };
  const STORAGE_KEY = 'host_generator_v1';

  // server.bot_difficulty - Progressive: the bots get harder as the players do better, only with the arena's own number of bots
  const BOT_DIFFICULTIES = [
    ['PROGRESSIVE', 'Progressive'],
    ['VERY_EASY', 'Very easy'],
    ['EASY', 'Easy'],
    ['MEDIUM', 'Medium'],
    ['HARD', 'Hard']
  ];

  const defaults = {
    name: '',
    cycle: ['de_cyberaqua', 'de_silo', 'fy_minilab'],
    cycleRandom: true,
    slots: 16,
    admins: '',
    password: '',
    passwordOn: false,
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
    bots: true,
    botDifficulty: 'PROGRESSIVE',
    botQuotaOn: false,
    botQuota: 6,
    browser: true,
    tPlayers: 16,
    tTeamSize: 1,
    tArenas: [],
    tPairing: 'first',
    tPage: true,
    tPagePort: 0,
    tTeams: [],
    tIdsText: '',
    tVerify: 'nicknames',
    tJoinTimeoutOn: true,
    tJoinTimeout: 10,
    serverWho: 'anyone',
    allowedPlayers: [],
    webhook: ''
  };

  let state = Object.assign({}, defaults);

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    Object.assign(state, saved);

    // a profile from the link replaces the settings - this browser's secrets stay
    if (linkedProfile) {
      const secrets = {};
      NOT_IN_LINK.forEach(k => { secrets[k] = state[k]; });

      state = Object.assign({}, defaults, linkedProfile.state || {}, secrets);
    }

    // saved before the password had its switch
    if (saved.password && saved.passwordOn === undefined) {
      state.passwordOn = true;
    }
  }
  catch (e) {}

  /*
    Whatever the link or the browser's storage brought in is checked against the defaults - a link is anyone's:
    a number out of its range or text where an arena or a port goes would end up in the commands and on the page.
  */

  function sanitizeState(raw) {
    const out = Object.assign({}, defaults);
    const ranges = { tJoinTimeout: [1, 30], botQuota: [1, 16], port: [1024, 65000], webPort: [1024, 65000], tPagePort: [0, 65535], slots: [4, 26], casual: [1, 8], tPlayers: [2, 64], tTeamSize: [1, 5], updateHour: [0, 23.5] };
    const enums = { tPairing: ['first', 'beforehand'], tVerify: ['nicknames', 'accounts'], serverWho: ['anyone', 'accounts'], botDifficulty: BOT_DIFFICULTIES.map(d => d[0]) };
    const arenaName = v => typeof v === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(v);

    // a listed player: a nickname, and an account id that can only be one - nothing else gets in
    const player = p => p && typeof p === 'object' && typeof p.n === 'string' && p.n.trim() !== '' && p.n.length <= 40
      ? [{ n: p.n.trim(), id: typeof p.id === 'string' && /^[A-Za-z0-9_]{0,80}$/.test(p.id) ? p.id : '' }]
      : [];

    const players = list => Array.isArray(list) ? [].concat(...list.map(player)) : [];

    // saved before the teams were chips: a line per team, the ids by nickname
    if ((!Array.isArray(raw.tTeams) || raw.tTeams.length === 0) && typeof raw.tTeamsText === 'string' && raw.tTeamsText.trim() !== '') {
      const ids = raw.tAccountIds && typeof raw.tAccountIds === 'object' ? raw.tAccountIds : {};

      raw = Object.assign({}, raw, {
        tTeams: raw.tTeamsText.split('\n')
          .map(line => line.split(',').map(n => n.trim()).filter(Boolean).map(n => ({ n, id: typeof ids[n] === 'string' ? ids[n] : '' })))
          .filter(team => team.length > 0)
      });
    }

    Object.keys(defaults).forEach(k => {
      const v = raw[k];
      const d = defaults[k];

      if (v === undefined || v === null) {
        return;
      }

      if (ranges[k]) {
        const [min, max] = ranges[k];

        if (typeof v === 'number' && Number.isFinite(v)) {
          out[k] = Math.max(min, Math.min(max, k === 'updateHour' ? Math.round(v * 2) / 2 : Math.round(v)));
        }
      }
      else if (enums[k]) {
        if (enums[k].includes(v)) {
          out[k] = v;
        }
      }
      else if (k === 'tTeams') {
        if (Array.isArray(v)) {
          // a team without players isn't kept - a New match left unfinished is gone after a reload
          out[k] = v.filter(Array.isArray).map(players).filter(team => team.length > 0).slice(0, 64);
        }
      }
      else if (k === 'allowedPlayers') {
        out[k] = players(v).slice(0, 256);
      }
      else if (Array.isArray(d)) {
        if (Array.isArray(v)) {
          out[k] = v.filter(arenaName);
        }
      }
      else if (k === 'tIdsText') {
        if (typeof v === 'string') {
          out[k] = v.slice(0, 20000);
        }
      }
      else if (k === 'timeZone') {
        if (typeof v === 'string' && /^[A-Za-z0-9_+\/-]{0,64}$/.test(v)) {
          out[k] = v;
        }
      }
      else if (typeof v === typeof d) {
        out[k] = v;
      }
    });

    // the ids that were in the teams' chips: into the ids box, the teams nicknames only
    if (!out.tIdsText) {
      const lines = [].concat(...out.tTeams).filter(p => p.id).map(p => `${p.n} ${p.id}`);
      out.tIdsText = lines.join('\n');
    }

    out.tTeams.forEach(team => team.forEach(p => { p.id = ''; }));
    return out;
  }

  state = sanitizeState(state);

  /*
    Each input re-reads its value when the tab changes - a saved profile or the defaults may differ.
  */
  const refreshers = [];
  const refreshInputs = () => refreshers.forEach(f => f());

  // the password is behind its switch
  const password = () => state.passwordOn && !byAccounts() ? state.password : '';

  // the teams set up beforehand, every player let in by their account - a join password adds nothing
  function verifiedByAccounts() {
    return isTournament() && state.tPairing === 'beforehand' && state.tVerify === 'accounts';
  }

  // a persistent server for its listed players only - the password adds nothing there either
  const serverByAccounts = () => !isTournament() && state.serverWho === 'accounts';
  const byAccounts = () => verifiedByAccounts() || serverByAccounts();

  function textInput(key, placeholder) {
    const i = el('input', { type: 'text', placeholder: placeholder || '' });
    i.value = state[key];
    i.addEventListener('input', () => { state[key] = i.value; update(); });
    refreshers.push(() => { i.value = state[key]; });
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
    refreshers.push(() => {
      if (document.activeElement !== i) {
        i.value = state[key];
      }
    });
    return i;
  }

  // a slider with its value next to it, for small counts
  function sliderInput(key, min, max) {
    const i = el('input', { type: 'range', min: String(min), max: String(max), step: '1', class: 'gen-slider' });
    const value = el('span', { class: 'gen-slider-value' });

    const sync = () => {
      // a value saved before the range was narrowed
      state[key] = Math.max(min, Math.min(max, state[key]));
      i.value = state[key];
      value.textContent = String(state[key]);
      i.style.setProperty('--fill', `${(state[key] - min) / (max - min) * 100}%`);
    };

    i.addEventListener('input', () => {
      state[key] = parseInt(i.value, 10);
      sync();
      update();
    });

    sync();
    refreshers.push(sync);
    return el('div', { class: 'gen-slider-row' }, [value, i]);
  }

  // a text box that suggests the matching time zones as you type (a datalist - the browser filters it)
  /*
    The AppImage only: with FUSE it mounts itself, without it --appimage-extract-and-run unpacks it to /tmp at every start.
  */

  function fuseInput() {
    const check = el('input', { type: 'checkbox' });
    check.checked = state.fuse;
    check.addEventListener('change', () => { state.fuse = check.checked; update(); });

    return el('div', { class: 'gen-option gen-fuse-option' }, [
      el('label', { class: 'gen-switch' }, [
        check,
        el('span', { class: 'gen-switch-track' }),
        el('span', { class: 'gen-switch-label', text: 'FUSE installed?' }),
        el('span', { class: 'gen-switch-note', text: 'skips an extract step' })
      ])
    ]);
  }

  // under the start command - it decides the command
  const fuseField = fuseInput();

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

  /*
    The cycle as numbered chips in its order - dragged to reorder, x to remove.
    Under them the other arenas: a click adds one at the end.
  */
  function cyclePicker() {
    const chips = el('div', { class: 'gen-cycle-chips' });
    const pool = el('div', { class: 'gen-cycle-pool' });
    const official = new Set(arenas.official);
    const all = arenas.official.concat(arenas.community);
    let dragged = null;

    // the game shuffles the cycle by default - unticked, the chips' order is the order played
    const randomCheck = el('input', { type: 'checkbox' });
    randomCheck.checked = state.cycleRandom;
    randomCheck.addEventListener('change', () => { state.cycleRandom = randomCheck.checked; render(); update(); });

    const randomOption = el('label', { class: 'gen-switch gen-random-option' }, [
      randomCheck,
      el('span', { class: 'gen-switch-track' }),
      document.createTextNode('In random order')
    ]);

    const resetButton = el('button', { type: 'button', class: 'gen-reset', text: 'Back to the default' });
    resetButton.addEventListener('click', () => {
      state.cycleRandom = true;
      randomCheck.checked = true;
      set(defaults.cycle.slice());
    });

    const set = cycle => {
      state.cycle = cycle;
      render();
      update();
    };

    function chip(name, i) {
      // the whole chip is the button - a click anywhere on it removes the arena, a drag moves it
      const c = el('span', { class: 'gen-chip', draggable: 'true', title: 'Click to remove, drag to reorder' }, [
        el('span', { class: 'gen-chip-no', text: String(i + 1) }),
        el('span', { text: name }),
        el('span', { class: 'gen-chip-remove', html: '&times;' })
      ]);

      c.addEventListener('click', () => set(state.cycle.filter((_, j) => j !== i)));

      c.addEventListener('dragstart', () => { dragged = i; c.classList.add('dragging'); });
      c.addEventListener('dragend', () => c.classList.remove('dragging'));
      c.addEventListener('dragover', e => e.preventDefault());
      c.addEventListener('drop', e => {
        e.preventDefault();

        if (dragged === null || dragged === i) {
          return;
        }

        const cycle = state.cycle.slice();
        const [moved] = cycle.splice(dragged, 1);
        cycle.splice(i, 0, moved);
        dragged = null;
        set(cycle);
      });

      return c;
    }

    function render() {
      chips.innerHTML = '';
      state.cycle.forEach((name, i) => chips.appendChild(chip(name, i)));

      if (!state.cycle.length) {
        chips.appendChild(el('span', { class: 'gen-cycle-empty', text: 'None - de_cyberaqua only' }));
      }

      randomOption.hidden = state.cycle.length < 2;
      randomCheck.checked = state.cycleRandom;
      resetButton.hidden = cycleIsDefault();

      pool.innerHTML = '';
      all.filter(name => !state.cycle.includes(name)).forEach(name => {
        const b = el('button', { type: 'button', class: 'gen-pool-chip' + (official.has(name) ? ' official' : ''), html: `<i class="fa-solid fa-plus"></i>${name}` });
        b.addEventListener('click', () => set(state.cycle.concat([name])));
        pool.appendChild(b);
      });
    }

    render();
    const browse = el('a', { class: 'gen-browse', href: '/arenas', target: '_blank', html: '<i class="fa-solid fa-arrow-up-right-from-square"></i>Browse the arenas' });
    const box = el('div', {}, [chips, randomOption, pool, el('div', { class: 'gen-cycle-links' }, [browse, resetButton])]);
    box.refresh = render;
    return box;
  }


  // a tournament opens a server per match and lets in only its players instead
  const casualInput = sliderInput('casual', 1, 8);
  const slotsInput = sliderInput('slots', 4, 26);



  function updatePortRows() {
    rebuildRounds();
  }


  const cycleBox = cyclePicker();

  const admins = el('input', { type: 'text', placeholder: 'your account id - 0x8aed41f2... or steam_7656119...' });
  admins.value = state.admins;
  admins.addEventListener('input', () => { state.admins = admins.value; update(); });

  const adminWarning = el('div', { class: 'gen-hint' });

  const advancedSet = () =>
    state.timeZone !== '' || state.webhook !== '' ||
    !state.autoupdate || state.updateHour !== 3
  ;

  /*
    A dropdown per bracket round - as many as the players make (16 players 1v1: 4 rounds), by default
    de_cyberaqua and de_silo by turns.
  */

  // "Set up beforehand": the teams' chips, the empty boxes left out - nicknames only
  const filledTeams = () => state.tTeams.filter(team => team.length > 0);
  const listedTeams = () => filledTeams().map(team => team.map(p => p.n));

  const pairedBeforehand = () => isTournament() && state.tPairing === 'beforehand';

  // "=" joins a nickname to its account id, "," and ";" separate the players and the teams - none can be in a nickname
  const unusableNickname = n => /[=;,]/.test(n);

  const playerEntry = p => verifiedByAccounts() && tournamentIdOf(p.n) ? `${p.n}=${tournamentIdOf(p.n)}` : p.n;
  const teamsArgument = separator => filledTeams().map(t => t.map(playerEntry).join(', ')).join(separator);

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
    s.addEventListener('change', () => {
      state.tTeamSize = parseInt(s.value, 10);

      // the listed players, in their order, into teams of the new size - 2v2 to 1v1 makes each one a team
      const players = [].concat(...state.tTeams);
      const teams = [];

      for (let i = 0; i < players.length; i += state.tTeamSize) {
        teams.push(players.slice(i, i + state.tTeamSize));
      }

      state.tTeams = teams;
      update();
    });
    return s;
  }

  /*
    Player pairings: by who joins first (nothing to prepare), or the teams and who plays whom written beforehand.
  */

  /*
    The listed players: the whole list as text, or the same as match cards under it - either one changes the other.
    A card is a match of round 1 as it will be played: the byes first, then the pairs. A team has exactly as many places
    as the team size - a player's chip or an empty place; a click on either types into it (the nickname - on a persistent server, then its account id).
    Dragging: a player onto a player swaps them, onto an empty place moves them there; a team by its handle swaps
    with the team it's dropped on; a team dropped on a bye's empty half plays that team.
  */

  function rosterEditor(opts) {
    const root = el('div', { class: 'gen-roster' });
    const board = el('div', { class: 'gen-roster-board' });
    const noFill = { autocomplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-bwignore': 'true' };

    const label = el('p', { class: 'gen-field-text gen-roster-label-text' });
    const text = el('textarea', Object.assign({ rows: '4', spellcheck: 'false', wrap: 'off', class: 'gen-roster-text' }, noFill));
    const hint = el('p', { class: 'gen-field-text gen-roster-hint' });

    root.appendChild(label);
    root.appendChild(text);
    root.appendChild(board);
    root.appendChild(hint);

    // the place being typed into: a team's index and the place in it; and what's being dragged
    let editing = null;
    let dragging = null;

    // the first team of a match added by "+ Match" - under the bracket until both its teams have someone
    let pendingMatch = null;

    // the teams as last drawn - replaced from outside (e.g. re-split for another team size), what pointed into them is gone
    let drawnTeams = null;

    const size = () => opts.withTeams() ? opts.teamSize() : Infinity;

    // "alice" or, with the ids, "alice 0x8aed..." (the id the last word) - entries separated by commas, semicolons or lines
    function parse(value) {
      return value.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean).map(e => {
        const m = opts.showIds() ? /^(.*\S)\s+(\S+)$/.exec(e) : null;
        return m ? { n: m[1].slice(0, 40), id: m[2] } : { n: e.slice(0, 40), id: '' };
      }).filter(p => p.n !== '');
    }

    const entry = p => opts.showIds() && p.id ? `${p.n} ${p.id}` : p.n;

    const serialize = () => opts.teams()
      .filter(team => team.length > 0)
      .map(team => team.map(entry).join(opts.withTeams() ? ', ' : '\n'))
      .join('\n');

    // what to paste, as the teams are: three example teams of the team's size - with account ids if they're needed
    function examplePlayers() {
      const names = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'gus', 'hal', 'ivy', 'jo', 'kim', 'leo', 'mia', 'ned', 'oli'];
      const ids = ['0x8aed...', 'steam_7656...', '0x3f9a...'];
      const player = (n, i) => opts.showIds() ? `${n} ${ids[i % ids.length]}` : n;

      if (!opts.withTeams()) {
        return names.slice(0, 3).map(player).join('\n');
      }

      const lines = [];

      for (let t = 0; t < 3; ++t) {
        lines.push(names.slice(t * opts.teamSize(), (t + 1) * opts.teamSize()).map((n, i) => player(n, t * opts.teamSize() + i)).join(', '));
      }

      return lines.join('\n');
    }

    // players into the given team while it has room, the rest into the first teams that aren't full - or new ones
    function addPlayers(players, intoTeam) {
      const teams = opts.teams();

      players.forEach(p => {
        if (!opts.withTeams()) {
          teams[0].push(p);
          return;
        }

        if (intoTeam !== null && teams[intoTeam] && teams[intoTeam].length < size()) {
          teams[intoTeam].push(p);
          return;
        }

        const open = teams.find(t => t.length < size());

        if (open) {
          open.push(p);
        }
        else {
          teams.push([p]);
        }
      });
    }

    // a team left without players is gone - only the New match's two wait for theirs
    function tidy() {
      const teams = opts.teams();

      if (!opts.withTeams()) {
        return;
      }

      for (let t = teams.length - 1; t >= 0; --t) {
        const pending = pendingMatch !== null && (t === pendingMatch || t === pendingMatch + 1);

        if (teams[t].length === 0 && !pending) {
          teams.splice(t, 1);

          // the New match after it moves up with the rest
          if (pendingMatch !== null && t < pendingMatch) {
            --pendingMatch;
          }
        }
      }
    }

    function changed() {
      tidy();
      update();
    }

    /*
      Typed into the text: the teams as it says - a nickname written without its id keeps the one it had,
      a line with more players than a team takes splits into teams of the right size.
    */

    text.addEventListener('input', () => {
      const had = {};
      [].concat(...opts.teams()).forEach(p => { had[p.n] = p.id; });

      const withId = p => p.id || !had[p.n] ? p : { n: p.n, id: had[p.n] };

      const chunks = players => {
        if (players.length <= size()) {
          return [players];
        }

        const out = [];

        for (let i = 0; i < players.length; i += size()) {
          out.push(players.slice(i, i + size()));
        }

        return out;
      };

      const lines = text.value.split('\n');

      const teams = opts.withTeams()
        ? [].concat(...lines.map(line => chunks(parse(line).map(withId)))).filter(team => team.length > 0)
        : [parse(lines.join(',')).map(withId)];

      opts.setTeams(teams);
      editing = null;
      pendingMatch = null;
      update();
    });

    text.addEventListener('blur', () => {
      text.value = serialize();
    });

    // typed into a place: Enter or leaving keeps it, Escape doesn't; emptied, the player's gone
    function commit(t, i, value, next) {
      const teams = opts.teams();
      const team = teams[t];

      if (!team) {
        editing = null;
        render();
        return;
      }

      const players = parse(value);

      if (i < team.length) {
        if (players.length === 0) {
          team.splice(i, 1);
        }
        else {
          team[i] = players[0];
          addPlayers(players.slice(1), t);
        }
      }
      else {
        addPlayers(players, t);
      }

      // Enter in an empty place goes on to the team's next empty one - or, the team full, the next team's
      const nextPlace = () => {
        if (!next || !players.length) {
          return null;
        }

        for (const candidate of [t, t + 1]) {
          if (teams[candidate] && teams[candidate].length < size()) {
            return { team: candidate, index: teams[candidate].length };
          }
        }

        return null;
      };

      editing = nextPlace();
      changed();
    }

    function placeInput(t, i) {
      const p = opts.teams()[t][i];
      const input = el('input', Object.assign({ type: 'text', class: 'gen-roster-place editing', placeholder: opts.showIds() ? 'nickname account-id' : 'nickname' }, noFill));
      input.value = p ? entry(p) : '';

      let done = false;

      const finish = keep => {
        if (done) {
          return;
        }

        done = true;

        if (keep) {
          commit(t, i, input.value, !p);
        }
        else {
          editing = null;
          render();
        }
      };

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true);
        }
        else if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
      });

      input.addEventListener('blur', () => finish(true));
      input.addEventListener('click', e => e.stopPropagation());
      setTimeout(() => {
        input.focus({ preventScroll: true });
        input.select();
      }, 0);

      return input;
    }

    function place(t, i) {
      const teams = opts.teams();
      const p = teams[t][i];

      if (editing && editing.team === t && editing.index === i) {
        return placeInput(t, i);
      }

      if (!p) {
        const empty = el('button', { type: 'button', class: 'gen-roster-place empty', 'data-team': String(t), 'data-index': String(i), html: '<i class="fa-solid fa-plus"></i>' });

        empty.addEventListener('click', e => {
          e.stopPropagation();
          editing = { team: t, index: i };
          render();
        });

        return empty;
      }

      const id = opts.idOf ? opts.idOf(p) : p.id;
      const ok = ACCOUNT_ID.test(id);
      const chip = el('button', {
        type: 'button',
        draggable: 'true',
        class: 'gen-roster-place filled' + (opts.withTeams() && unusableNickname(p.n) ? ' gen-bad' : ''),
        'data-team': String(t),
        'data-index': String(i)
      }, [el('span', { class: 'gen-chip-name', text: p.n })]);

      if (opts.showStatus ? opts.showStatus() : opts.showIds()) {
        const status = el('i', { class: ok ? 'fa-solid fa-check gen-chip-ok' : 'fa-solid fa-exclamation gen-chip-missing', 'data-tip': ok ? id : (id ? 'Not an account id' : (opts.onMissingId ? 'No account id yet - click to add it' : 'No account id yet - click to add it after the nickname')) });

        // the "!" of a player without an id: their line in the ids box, ready for the id
        if (!ok && opts.onMissingId) {
          status.addEventListener('click', e => {
            e.stopPropagation();
            opts.onMissingId(p.n);
          });
        }

        chip.appendChild(status);
      }

      const remove = el('span', { class: 'gen-roster-x', html: '<i class="fa-solid fa-xmark"></i>', 'data-tip': 'Remove' });

      remove.addEventListener('click', e => {
        e.stopPropagation();
        teams[t].splice(i, 1);
        editing = null;
        changed();
      });

      chip.appendChild(remove);

      chip.addEventListener('click', e => {
        e.stopPropagation();
        editing = { team: t, index: i };
        render();
      });

      chip.addEventListener('dragstart', e => {
        e.stopPropagation();

        // 1v1: the player is the team - dragged as a team too (onto a bye's empty half)
        dragging = size() === 1 ? { chip: [t, i], team: t } : { chip: [t, i] };
        e.dataTransfer.setData('text/plain', JSON.stringify(dragging));
      });

      chip.addEventListener('dragend', () => { dragging = null; });
      return chip;
    }

    function teamBox(t) {
      const team = opts.teams()[t];
      const places = opts.withTeams() ? Math.max(size(), team.length) : team.length + 1;
      const slots = el('div', { class: 'gen-roster-places' });

      for (let i = 0; i < places; ++i) {
        slots.appendChild(place(t, i));
      }

      const box = el('div', { class: 'gen-roster-team2', 'data-team-box': String(t) });

      if (opts.withTeams() && size() > 1) {
        const handle = el('span', { class: 'gen-roster-handle', draggable: 'true', html: '<i class="fa-solid fa-grip-vertical"></i>', 'data-tip': 'Drag the team' });

        handle.addEventListener('dragstart', e => {
          dragging = { team: t };
          e.dataTransfer.setData('text/plain', JSON.stringify(dragging));
        });

        handle.addEventListener('dragend', () => { dragging = null; });
        box.appendChild(handle);
      }

      box.appendChild(slots);
      return box;
    }

    // a team dropped next to one with a bye: both moved to the first pair, the teams there taking their places
    function pairWithBye(byeTeam, team, firstPair) {
      const teams = opts.teams();
      const swap = (a, b) => { [teams[a], teams[b]] = [teams[b], teams[a]]; };

      swap(byeTeam, firstPair);
      const from = team === firstPair ? byeTeam : team;

      if (from !== firstPair + 1) {
        swap(from, firstPair + 1);
      }

      changed();
    }

    function drop(e) {
      const teams = opts.teams();
      const what = dragging;
      const byeSlot = e.target.closest('[data-bye-slot]');
      const onPlace = e.target.closest('[data-index]');
      const onTeam = e.target.closest('[data-team-box]');

      if (!what) {
        return;
      }

      if (byeSlot && typeof what.team === 'number') {
        pairWithBye(parseInt(byeSlot.dataset.byeSlot, 10), what.team, parseInt(byeSlot.dataset.firstPair, 10));
        return;
      }

      if (what.chip && onPlace) {
        const [ft, fi] = what.chip;
        const tt = parseInt(onPlace.dataset.team, 10);
        const ti = parseInt(onPlace.dataset.index, 10);

        if (!teams[ft] || !teams[ft][fi] || !teams[tt] || (ft === tt && fi === ti)) {
          return;
        }

        if (teams[tt][ti]) {
          [teams[ft][fi], teams[tt][ti]] = [teams[tt][ti], teams[ft][fi]];
        }
        else if (ft !== tt) {
          teams[tt].push(teams[ft].splice(fi, 1)[0]);
        }

        changed();
        return;
      }

      if (typeof what.team === 'number' && onTeam) {
        const tt = parseInt(onTeam.dataset.teamBox, 10);

        // a team traded only for another one with players - an empty one (a New match) takes players, not teams
        if (tt !== what.team && teams[tt] && teams[what.team] && teams[tt].length > 0 && teams[what.team].length > 0) {
          [teams[what.team], teams[tt]] = [teams[tt], teams[what.team]];
          changed();
        }
      }
    }

    // where it lands: the place (a swap or a move), the team, or a bye's empty half
    function dropTargetOf(e) {
      if (!dragging) {
        return null;
      }

      const byeSlot = e.target.closest('[data-bye-slot]');

      if (byeSlot) {
        return typeof dragging.team === 'number' ? byeSlot : null;
      }

      if (dragging.chip) {
        return e.target.closest('[data-index]');
      }

      return e.target.closest('[data-team-box]');
    }

    board.addEventListener('dragover', e => {
      const target = dropTargetOf(e);
      board.querySelectorAll('.gen-drop').forEach(x => x.classList.remove('gen-drop'));

      if (target) {
        e.preventDefault();
        target.classList.add('gen-drop');
      }
    });

    board.addEventListener('dragleave', e => {
      if (!board.contains(e.relatedTarget)) {
        board.querySelectorAll('.gen-drop').forEach(x => x.classList.remove('gen-drop'));
      }
    });

    board.addEventListener('drop', e => {
      e.preventDefault();
      board.querySelectorAll('.gen-drop').forEach(x => x.classList.remove('gen-drop'));
      drop(e);
      dragging = null;
    });

    function render() {
      const teams = opts.teams();
      const withTeams = opts.withTeams();

      if (withTeams && drawnTeams !== null && drawnTeams !== teams) {
        pendingMatch = null;
        editing = null;
      }

      drawnTeams = withTeams ? teams : null;
      board.innerHTML = '';
      board.classList.toggle('single', !withTeams);

      if (!withTeams) {
        board.appendChild(teamBox(0));
      }
      else {
        /*
          The bracket of the teams with players - the empty ones (only at the end, from "+ Match") wait under it
          as a new match, changing nothing above until someone's in them.
        */

        const pairFilled = pendingMatch !== null && teams[pendingMatch] && teams[pendingMatch + 1] && teams[pendingMatch].length > 0 && teams[pendingMatch + 1].length > 0;

        if (pendingMatch !== null && (pairFilled || !teams[pendingMatch] || pendingMatch + 1 >= teams.length)) {
          pendingMatch = null;
        }

        // the teams with players from the start - the bracket; an empty one right after them is a lone team's opponent
        const limit = pendingMatch !== null ? pendingMatch : teams.length;
        let filled = 0;

        while (filled < limit && teams[filled].length > 0) {
          ++filled;
        }
        let bracket = 1;

        while (bracket < filled) {
          bracket *= 2;
        }

        const byes = filled >= 2 ? bracket - filled : 0;
        let match = 0;

        for (let t = 0; t < filled; ++t) {
          if (t < byes) {
            const slot = el('div', { class: 'gen-roster-bye-slot', 'data-bye-slot': String(t), 'data-first-pair': String(byes), 'data-tip': 'Drop a team here to make them play each other' });
            board.appendChild(el('div', { class: 'gen-roster-match bye' }, [el('span', { class: 'gen-roster-match-name', text: 'Bye' }), teamBox(t), el('span', { class: 'gen-roster-vs' }), slot]));
            continue;
          }

          if ((t - byes) % 2 === 1) {
            continue;
          }

          ++match;
          const row = el('div', { class: 'gen-roster-match' }, [el('span', { class: 'gen-roster-match-name', text: `Match ${match}` }), teamBox(t)]);

          if (t + 1 < filled) {
            row.appendChild(el('span', { class: 'gen-roster-vs', text: 'vs' }));
            row.appendChild(teamBox(t + 1));
          }
          else if (filled < limit && teams[filled] && teams[filled].length === 0) {
            // a team without an opponent: the empty team after it is that opponent, in the same row - not a New match's
            row.appendChild(el('span', { class: 'gen-roster-vs', text: 'vs' }));
            row.appendChild(teamBox(filled));
          }
          else {
            // a team without an opponent yet: an empty place for one
            const opponent = el('button', { type: 'button', class: 'gen-roster-place empty', html: '<i class="fa-solid fa-plus"></i>' });

            opponent.addEventListener('click', e => {
              e.stopPropagation();

              // right after the lone team - before a New match, which moves down
              teams.splice(filled, 0, []);

              if (pendingMatch !== null) {
                ++pendingMatch;
              }

              editing = { team: filled, index: 0 };
              update();
            });

            row.appendChild(el('span', { class: 'gen-roster-vs', text: 'vs' }));
            row.appendChild(el('div', { class: 'gen-roster-team2' }, [el('div', { class: 'gen-roster-places' }, [opponent])]));
          }

          board.appendChild(row);
        }

        // an odd team's empty opponent is in its row already
        const loneOpponent = filled < limit && filled % 2 === 1 && byes === 0 && teams[filled] && teams[filled].length === 0 ? 1 : 0;

        for (let t = pendingMatch !== null ? pendingMatch : filled + loneOpponent; t < teams.length; t += 2) {
          const row = el('div', { class: 'gen-roster-match pending' }, [el('span', { class: 'gen-roster-match-name', text: 'New match' }), teamBox(t)]);

          if (t + 1 < teams.length) {
            row.appendChild(el('span', { class: 'gen-roster-vs', text: 'vs' }));
            row.appendChild(teamBox(t + 1));
          }

          board.appendChild(row);
        }

        // a new match: two empty teams at the end, the first place ready for a nickname
        const newMatch = el('button', { type: 'button', class: 'gen-roster-new-match', html: '<i class="fa-solid fa-plus"></i>Match' });

        newMatch.addEventListener('click', () => {
          // a New match there already: its first free place
          if (pendingMatch !== null && teams[pendingMatch] && teams[pendingMatch + 1]) {
            const t = teams[pendingMatch].length < size() ? pendingMatch : pendingMatch + 1;
            editing = { team: t, index: teams[t].length };
            update();
            return;
          }

          // a team still without an opponent: that place first
          if (filled % 2 === 1 && byes === 0) {
            if (!teams[filled]) {
              teams.push([]);
            }

            editing = { team: filled, index: teams[filled].length };
            update();
            return;
          }

          // two empty teams at the end - any empty ones left there make room for them
          while (teams.length && teams[teams.length - 1].length === 0) {
            teams.pop();
          }

          teams.push([], []);
          pendingMatch = teams.length - 2;
          editing = { team: pendingMatch, index: 0 };
          update();
        });

        board.appendChild(newMatch);
      }

      if (document.activeElement !== text) {
        text.value = serialize();
      }

      text.placeholder = examplePlayers();
      label.textContent = withTeams ? 'Paste all the teams at once, or use the widgets below:' : 'Paste all the players at once, or use the widgets below:';
      // the persistent server's list only: what to type into a place - the rest is plain to see
      hint.innerHTML = withTeams ? '' : 'A player per line: the nickname, then the account id.';
      hint.hidden = withTeams;
    }

    root.render = render;
    return root;
  }

  /*
    Who gets in: anyone (paired as they join), or the listed teams - by their nicknames, or by their accounts.
  */

  const whoGetsIn = () => state.tPairing !== 'beforehand' ? 'anyone' : state.tVerify === 'accounts' ? 'accounts' : 'nicknames';

  const pairingSelect = el('select', {}, [
    el('option', { value: 'anyone', text: 'Anyone' }),
    el('option', { value: 'nicknames', text: 'Listed nicknames' }),
    el('option', { value: 'accounts', text: 'Listed accounts (secure)' })
  ]);

  /*
    The listed accounts' ids: a player per line - "alice 0x8aed...", the id the last word.
    More lines than players don't matter; the order neither.
  */

  function idLines() {
    const out = {};

    state.tIdsText.split('\n').forEach(line => {
      const l = line.trim();

      if (!l) {
        return;
      }

      // the id is the last word, the nickname what's before it - spaces in it too
      const m = /^(.*\S)\s+(\S+)$/.exec(l);

      if (m) {
        out[m[1]] = m[2];
      }
    });

    return out;
  }

  const tournamentIdOf = n => idLines()[n] || '';

  const idsText = el('textarea', { rows: '4', spellcheck: 'false', wrap: 'off', class: 'gen-roster-text', placeholder: 'alice 0x8aed41f2...\nbob steam_76561198...', autocomplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-bwignore': 'true' });

  idsText.addEventListener('input', () => {
    state.tIdsText = idsText.value;
    update();
  });

  // a player's "!": their nickname on a new line of the ids box, the cursor after it
  function focusIdLine(n) {
    if (!(n in idLines())) {
      state.tIdsText = (state.tIdsText.trim() ? state.tIdsText.replace(/\s*$/, '\n') : '') + `${n} `;
    }

    idsText.value = state.tIdsText;
    idsText.focus();
    idsText.setSelectionRange(idsText.value.length, idsText.value.length);
    update();
  }

  const idsLabel = el('p', { class: 'gen-field-text', text: 'Their account ids - a player per line, the nickname and the id:' });

  const teamsRoster = rosterEditor({
    teams: () => state.tTeams,
    setTeams: teams => { state.tTeams = teams; },
    withTeams: () => true,
    teamSize: () => state.tTeamSize,

    // the teams are nicknames only - the account ids are in their own box
    showIds: () => false,
    showStatus: () => verifiedByAccounts(),
    idOf: p => tournamentIdOf(p.n),
    onMissingId: n => focusIdLine(n)
  });

  pairingSelect.value = whoGetsIn();

  pairingSelect.addEventListener('change', () => {
    const v = pairingSelect.value;
    state.tPairing = v === 'anyone' ? 'first' : 'beforehand';
    state.tVerify = v === 'accounts' ? 'accounts' : 'nicknames';
    update();
  });

  refreshers.push(() => { pairingSelect.value = whoGetsIn(); });

  const playersInput = sliderInput('tPlayers', 2, 64);
  const teamSize = teamSizeSelect();

  function updatePairing() {
    const beforehand = state.tPairing === 'beforehand';

    teamsRoster.hidden = !beforehand;

    if (beforehand) {
      teamsRoster.render();
    }

  }

  const roundSummary = el('p', { class: 'gen-field-text' });

  // what the generator gives for each setup, then the firewall
  // the generator's results for each setup - the firewall's always last
  const OUTPUTS = {
    compose: ['compose', 'firewall'],
    run: ['run', 'firewall'],
    terminal: ['json', 'firewall'],
    service: ['json', 'service', 'firewall']
  };

  const outputsOf = () => OUTPUTS[method()].slice();

  /*
    A result: its file as the first line - copyable apart from it, above a dashed line - the code, a hint under it.
    Unneeded: the file's path struck through and grey, nothing to copy.
  */

  function resultBox({ file = '', lang = '', text = '', hint = '', unneeded = false }) {
    const code = el('code', { text });
    const box = el('div', { class: 'guide-code' + (file ? ' with-file' : '') + (unneeded ? ' unneeded' : '') }, [
      el('div', { class: 'guide-code-file' }, [
        el('code', { text: file }),
        el('button', { type: 'button', class: 'gen-inline-copy', title: 'Copy the path', html: '<i class="fa-regular fa-copy"></i>' })
      ]),
      el('button', { type: 'button', class: 'guide-copy', title: 'Copy', html: '<i class="fa-regular fa-copy"></i>' }),
      el('pre', {}, [code])
    ]);

    if (!file) {
      box.firstChild.remove();
    }

    highlight(code, lang);

    const out = el('div', { class: 'gen-result' }, [box]);

    if (hint) {
      out.appendChild(el('p', { class: 'gen-hint', html: hint }));
    }

    return out;
  }

  /*
    How to start the server with this config - always shown under the results (not for docker run: that is the command).
  */

  const startCode = el('code');
  const startHint = el('p', { class: 'gen-hint' });

  const startBlock = el('div', {}, [
    el('div', { class: 'guide-code gen-start-code' }, [
      el('button', { type: 'button', class: 'guide-copy', title: 'Copy', html: '<i class="fa-regular fa-copy"></i>' }),
      el('pre', {}, [startCode])
    ]),
    startHint,
    fuseField
  ]);

  // the config's files, and the firewall - remade on every change
  const configResults = el('div');
  const serviceResults = el('div');
  const secretResults = el('div');
  const firewallResults = el('div');

  /*
    Check that it works: what the players should see, for a server or a tournament.
  */

  const checkText = el('p', { class: 'gen-field-text' });
  const checkImage = el('img', { class: 'guide-image', alt: '' });

  const checkBlock = el('div', { class: 'gen-check-box' }, [checkText, checkImage]);

  // the results page first: up at its address - and linked next to the matches on hypersomnia.io/servers
  function pageCheck() {
    if (!pageOn()) {
      return '';
    }

    return `Within a minute your matches are on:<br><a href="/servers" target="_blank">hypersomnia.io/servers</a><br>with <span class="gen-results-tag"><i class="fa-solid fa-trophy"></i> Results</span> next to them - your tournament's results page:<br><code>http://&lt;your server&gt;:${pagePort()}/</code><br><br>`;
  }

  function updateCheck() {
    if (isTournament() && state.tPairing === 'beforehand') {
      checkText.innerHTML = pageCheck() + 'Players on your network see every match under <strong>Ongoing Tournament</strong> in <code>Browse servers</code>.<br>Players must join the server that mentions their team/nickname:';
      checkImage.src = '/assets/images/generator/server_browser_tournament.png';
      checkImage.alt = 'The tournament\'s matches in Browse servers';
    }
    else if (isTournament()) {
      checkText.innerHTML = pageCheck() + 'Players on your network see every match under <strong>Ongoing Tournament</strong> in <code>Browse servers</code>.<br>Until it is full, a match says <code>(any pair)</code> - anyone may join it.<br>Then it is named by its players:';
      checkImage.src = '/assets/images/generator/server_browser_tournament_open.png';
      checkImage.alt = 'The tournament\'s matches in Browse servers';
    }
    else {
      checkText.innerHTML = 'Within a minute your server is on:<br><a href="/servers" target="_blank">hypersomnia.io/servers</a><br>and in <code>Browse servers</code> in the game.<br><br>On the list but nobody can join?<br>Open the ports - see <code>Your firewall commands</code> above.';
      checkImage.src = '/assets/images/generator/server_browser.png';
      checkImage.alt = 'Your server in Browse servers';
    }
  }

  /*
    What to do once before the config: the executable, or Docker's data folder.
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

  // the same switches as the settings' table
  const optionSwitch = (check, label, note) => el('div', { class: 'gen-option' }, [
    el('label', { class: 'gen-switch' }, [
      check,
      el('span', { class: 'gen-switch-track' }),
      el('span', { class: 'gen-switch-label', text: label }),
      el('span', { class: 'gen-switch-note', text: note })
    ])
  ]);

  const serviceOption = optionSwitch(serviceCheck, 'As a service', 'systemd - starts with the machine, runs without a terminal');
  const userOption = optionSwitch(userCheck, 'As a separate user', 'hypersomnia, everything in /opt/hypersomnia');

  // the AppImage's executable, or Docker's data folder
  const beforeTitle = () => 'Your setup commands';

  const beforeBlock = el('div', { class: 'gen-before-box' }, [
    serviceOption,
    userOption,
    el('div', { class: 'guide-code gen-start-code' }, [
      el('button', { type: 'button', class: 'guide-copy', title: 'Copy', html: '<i class="fa-regular fa-copy"></i>' }),
      el('pre', {}, [beforeCode])
    ])
  ]);


  /*
    Under what shows --appimage-extract-and-run: the start command in a terminal, the service's file as a service.
  */

  function updateFuseField(serviceBox) {
    const terminal = method() === 'terminal';

    if (terminal && fuseField.parentElement !== startBlock) {
      startBlock.appendChild(fuseField);
    }
    else if (serviceBox) {
      serviceBox.after(fuseField);
    }

    fuseField.hidden = !(terminal || serviceBox);
  }

  function beforeText() {
    const key = method() === 'service' && state.serviceUser ? 'serviceUser' : method();
    return BEFORE[key] || '';
  }

  function updateBefore() {
    steps.before.title.textContent = beforeTitle();
    serviceOption.hidden = currentSetup !== 'server-appimage';
    userOption.hidden = method() !== 'service';
    beforeCode.textContent = beforeText();
    steps.before.el.hidden = !BEFORE[method()];
    highlight(beforeCode, 'bash');
  }
  setupListeners.push(() => update());

  /*
    The persistent server's settings as one table: a label on the left, one control on the right.
    A list (the map cycle, the ports) shows its value in one line - a click opens its editor under it.
  */

  // 3.5 -> "03:30", as the game reads it
  function hourText(h) {
    const minutes = Math.round(h * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  function cycleIsDefault() {
    return JSON.stringify(state.cycle) === JSON.stringify(defaults.cycle) && state.cycleRandom;
  }

  function settingRow(label, controls, help) {
    const name = el('div', { class: 'gen-row-name' }, [document.createTextNode(label)]);

    if (help) {
      // our own tooltip - shown at once, unlike the browser's title
      name.appendChild(el('i', { class: 'fa-regular fa-circle-question gen-row-help', 'data-tip': help, 'aria-label': help, tabindex: '0' }));
    }

    return el('div', { class: 'gen-row' }, [name, el('div', { class: 'gen-row-ctl' }, controls)]);
  }

  // its value in one line, "default" next to it when it is - a click opens the editor under it
  function foldRow(label, help, editor) {
    const value = el('span', { class: 'gen-summary-value' });
    const isDefault = el('span', { class: 'gen-summary-default', text: 'default' });
    const button = el('button', { type: 'button', class: 'gen-summary' }, [value, isDefault, el('i', { class: 'fa-solid fa-chevron-down' })]);
    const row = settingRow(label, [button], help);

    row.appendChild(el('div', { class: 'gen-row-editor' }, [editor]));
    button.addEventListener('click', () => row.classList.toggle('open'));

    row.show = (html, atDefault) => {
      value.innerHTML = html;
      isDefault.hidden = !atDefault;
    };

    return row;
  }

  // a switch - the whole of it one click
  function switchInput(key, onChange, note) {
    const check = el('input', { type: 'checkbox' });
    check.checked = state[key];
    check.addEventListener('change', () => {
      state[key] = check.checked;
      onChange();
      update();
    });
    refreshers.push(() => { check.checked = state[key]; });

    const children = [check, el('span', { class: 'gen-switch-track' })];

    if (note) {
      children.push(el('span', { class: 'gen-switch-note', html: note }));
    }

    return el('label', { class: 'gen-switch' }, children);
  }

  // a switch that shows its text box when it's on
  function revealRow(label, key, input, help) {
    const sync = () => { input.hidden = !state[key]; };
    const row = settingRow(label, [switchInput(key, () => {
      sync();

      if (state[key]) {
        input.focus();
      }
    }), input], help);

    sync();
    refreshers.push(sync);
    return row;
  }

  const cycleRow = foldRow('Map cycle', 'The first one starts.', cycleBox);

  /*
    Bots: on by default - their difficulty, and how many: the arena's own number unless set here.
    Progressive goes only with the arena's own number - with a number set, the game plays them at a fixed difficulty.
  */

  const botDifficultySelect = el('select', {}, BOT_DIFFICULTIES.map(([value, text]) => el('option', { value, text })));

  botDifficultySelect.addEventListener('change', () => {
    state.botDifficulty = botDifficultySelect.value;
    update();
  });

  const syncBotQuota = () => {
    if (state.botQuotaOn && state.botDifficulty === 'PROGRESSIVE') {
      state.botDifficulty = 'MEDIUM';
    }
  };

  const botQuotaSlider = sliderInput('botQuota', 1, 16);

  // how many: the map's own number, or a fixed one
  const botCountSelect = el('select', {}, [
    el('option', { value: 'map', text: 'Map default' }),
    el('option', { value: 'fixed', text: 'Fixed number' })
  ]);

  botCountSelect.addEventListener('change', () => {
    state.botQuotaOn = botCountSelect.value === 'fixed';
    syncBotQuota();
    update();
  });

  const botDetails = el('div', { class: 'gen-bots-details' }, [
    el('div', { class: 'gen-bots-line' }, [el('span', { class: 'gen-bots-label', text: 'Difficulty' }), botDifficultySelect]),
    el('div', { class: 'gen-bots-line' }, [el('span', { class: 'gen-bots-label', text: 'How many' }), botCountSelect, botQuotaSlider])
  ]);

  const botsRow = foldRow('Bots', 'Bots fill the teams when players are missing. Map default: as many as the arena says. Progressive: they get harder as the players do better - only with the map default.', el('div', { class: 'gen-bots' }, [
    switchInput('bots', () => {}, 'fill the teams with bots'),
    botDetails
  ]));

  const botDifficultyText = () => (BOT_DIFFICULTIES.find(d => d[0] === state.botDifficulty) || BOT_DIFFICULTIES[0])[1];
  const botsAtDefault = () => state.bots && state.botDifficulty === 'PROGRESSIVE' && !state.botQuotaOn;

  const tablePort = numberInput('port', 1024, 65000, false);
  const tableWebPort = numberInput('webPort', 1024, 65000, false);
  const tableWebHead = el('span', { class: 'gen-ports-head', html: '<i class="fa-solid fa-globe"></i>Browser players' });

  // a tournament's results page: the game port's number over TCP - shown, not typed
  const tablePagePort = el('input', { type: 'number', min: '1', max: '65535', class: 'no-spin' });

  tablePagePort.addEventListener('input', () => {
    const v = parseInt(tablePagePort.value, 10);

    // the game port's number again: no port of its own
    state.tPagePort = isNaN(v) || v === state.port ? 0 : Math.max(1, Math.min(65535, v));
    update();
  });
  const tablePageHead = el('span', { class: 'gen-ports-head', html: '<i class="fa-solid fa-trophy"></i>Results page' });

  const portsRow = foldRow('Ports', 'Change them only if 8412 or 9000 is taken on this machine.', el('div', { class: 'gen-ports' }, [
    el('span', { class: 'gen-ports-head', html: '<i class="fa-solid fa-gamepad"></i>Game' }),
    tableWebHead,
    tablePageHead,
    tablePort,
    tableWebPort,
    tablePagePort
  ]));

  const adminRow = revealRow('Admin', 'adminOn', admins, 'In the game: Settings → Account. Lets you manage the server in-game: maps, bans... In a tournament: watch any match, and close round 1 when not everyone came.');
  adminRow.appendChild(el('div', { class: 'gen-row-editor gen-row-note' }, [adminWarning]));

  const hourSelect = el('select', { class: 'gen-hour' });

  // every half an hour
  for (let h = 0; h < 24; h += 0.5) {
    hourSelect.appendChild(el('option', { value: String(h), text: hourText(h) }));
  }

  hourSelect.value = String(state.updateHour);
  hourSelect.addEventListener('change', () => { state.updateHour = parseFloat(hourSelect.value); update(); });

  // off: no hour to choose
  const syncHour = () => { hourSelect.hidden = !state.autoupdate; };
  syncHour();

  /*
    The tournament's rows: the size of the teams first - it says how to write the list of them.
  */

  const pairingRow = settingRow('Who gets in', [pairingSelect], 'On a LAN, Anyone or Listed nicknames is enough - people there trust each other.');

  // however they join first: what it means for the players
  const firstText = el('p', { class: 'gen-field-text', html: 'Players join <strong>any server</strong> they want <em>in the first round</em>.<br>They can use <strong>any nicknames</strong> they like.<br>In later rounds, they will be paired automatically.' });

  // set up beforehand: the list and how it was understood - the rounds say it better than any explanation
  const nicknamesText = el('p', { class: 'gen-field-text' });
  // right under the list it's about
  // the first line under the choice, whichever lets anyone take a nickname
  const insecureText = el('p', { class: 'gen-field-text gen-security' });
  const pairingEditor = el('div', { class: 'gen-row-editor' }, [insecureText, firstText, teamsRoster, nicknamesText]);
  pairingRow.appendChild(pairingEditor);

  const playersRow = settingRow('Players', [playersInput, roundSummary]);

  /*
    Join timeout: a match of any round that hasn't started by then is decided without it - the team that came wins,
    nobody: both out. With Anyone, round 1's servers close as if Close round 1 were clicked. The matches being played go on.
  */

  // with Anyone, round 1 has no teams to wait for - one sentence on what happens there instead
  const joinTimeoutHelp = anyone => 'Server waits this long for all players to join the match. After that, the team with more players present wins - with equal numbers the match starts as they are,\nand if nobody came, both teams are out.' +
    (anyone ? '\nRound 1: a player left alone on a server advances to the next round without playing.' : '') +
    '\nDoesn\'t affect running matches.';

  const joinTimeoutSelect = el('select', {}, Array.from({ length: 30 }, (_, i) => el('option', { value: String(i + 1), text: `${i + 1} min` })));

  joinTimeoutSelect.addEventListener('change', () => {
    state.tJoinTimeout = parseInt(joinTimeoutSelect.value, 10);
    update();
  });

  const joinTimeoutRow = settingRow('Join timeout', [switchInput('tJoinTimeoutOn', () => {}), joinTimeoutSelect], joinTimeoutHelp(false));

  /*
    A persistent server's Who gets in: anyone, or only its listed players - each by their account id.
  */

  const serverWhoSelect = el('select', {}, [
    el('option', { value: 'anyone', text: 'Anyone' }),
    el('option', { value: 'accounts', text: 'Listed accounts (clan server)' })
  ]);

  serverWhoSelect.addEventListener('change', () => {
    state.serverWho = serverWhoSelect.value;
    update();
  });

  const serverRoster = rosterEditor({
    teams: () => [state.allowedPlayers],
    setTeams: teams => { state.allowedPlayers = teams[0] || []; },
    withTeams: () => false,
    teamSize: () => 0,
    showIds: () => true
  });

  const serverSecurityText = el('p', { class: 'gen-field-text gen-security' });
  const serverVerifyText = el('p', { class: 'gen-field-text', html: 'Every player must send you their account id.<br>Account ids are public - safe to share.<br>In the game: <code>Settings → Account → Copy account id</code>:' });
  const serverIdImage = accountIdImage();
  const serverNamesText = el('p', { class: 'gen-field-text', html: 'Nicknames are only for your convenience:<br>players may play under any other name. Admins always get in.' });
  const serverWhoEditor = el('div', { class: 'gen-row-editor' }, [serverSecurityText, serverVerifyText, serverIdImage, serverRoster, serverNamesText]);
  const serverWhoRow = settingRow('Who gets in', [serverWhoSelect], 'Listed accounts: only the players you list get in - each proves their account, so nobody can join in their place. Anyone else: "This server lets in only its listed players".');
  serverWhoRow.appendChild(serverWhoEditor);

  /*
    Verify players by: their nicknames (anyone may take one - enough among friends on a LAN), or their accounts -
    a box for each player's account id, the nickname only shown.
  */

  const verifyText = el('p', { class: 'gen-field-text' });
  // where each participant copies theirs - dimmed as the other pictures, lit when pointed at
  function accountIdImage() {
    return el('img', { class: 'guide-image gen-account-id-image', src: '/assets/images/generator/copy_account_id.png?t=3', alt: 'Settings → Account → Copy account id, in the game', loading: 'lazy' });
  }
  const tournamentIdImage = accountIdImage();
  // listed accounts: where to get them, right over the players
  // the teams first, then where the ids come from and their box
  [verifyText, tournamentIdImage, idsLabel, idsText].forEach(e => pairingEditor.insertBefore(e, nicknamesText));
  verifyText.classList.add('gen-after-gap');

  const defaultRoundMaps = () => roundMaps().map((_, i) => i % 2 === 0 ? 'de_cyberaqua' : 'de_silo');
  const mapsRow = foldRow('Maps for each stage', '', roundsBox);

  const serverRows = [];
  const tournamentRows = [];
  const only = (list, row) => {
    list.push(row);
    return row;
  };

  const passwordNote = el('span', { class: 'gen-switch-note', text: 'Redundant - the players are verified by their account ids.' });
  const passwordRow = revealRow('Join password', 'passwordOn', textInput('password', 'what players type to join'), 'Without it, anyone can join.');
  passwordRow.querySelector('.gen-row-ctl').appendChild(passwordNote);

  const serverTable = el('div', { class: 'gen-table' }, [
    only(serverRows, settingRow('Server name', [textInput('name', 'My server')])),
    only(serverRows, cycleRow),
    only(serverRows, settingRow('Slots', [sliderInput('slots', 4, 26)])),
    only(serverRows, settingRow('Server instances', [casualInput], 'If hosting multiple instances, they will take subsequent ports.')),
    only(serverRows, botsRow),
    only(tournamentRows, settingRow('Teams', [teamSize])),
    only(tournamentRows, pairingRow),
    only(tournamentRows, playersRow),
    only(tournamentRows, joinTimeoutRow),
    only(tournamentRows, mapsRow),
    only(tournamentRows, settingRow('Live results page', [switchInput('tPage', () => {}, '<code>http://&lt;your server&gt;:<span class="gen-page-port"></span>/</code>')], 'The bracket with live scores. Served by the game server itself over TCP.')),
    settingRow('Browser players', [switchInput('browser', () => {}, 'from <a href="https://play.hypersomnia.io" target="_blank">play.hypersomnia.io</a>')]),
    portsRow,
    only(serverRows, serverWhoRow),
    passwordRow,
    adminRow
  ]);

  // rarely needed - behind one button, open if anything in it is set
  const serverAdvanced = el('div', { class: 'gen-table gen-table-advanced' }, [
    only(serverRows, settingRow('Daily update', [switchInput('autoupdate', syncHour), hourSelect], "Players with a newer version cannot join an older server. Every day at this hour (the machine's time) the server restarts if a new version is out.")),
    only(serverRows, settingRow('Time zone', [timeZoneSelect()], 'Where the server is. Players in the browser see from it roughly how far the server is; happy hours (2x MMR) follow it. A VPS is often in UTC.')),
    settingRow('Discord webhook', [textInput('webhook', 'to post joins and match results to your Discord')])
  ]);

  const serverAdvancedButton = el('button', { type: 'button', class: 'gen-table-toggle' });

  function showServerAdvanced(open) {
    serverAdvanced.hidden = !open;
    serverAdvancedButton.textContent = open ? 'Hide advanced options' : 'Show advanced options';
  }

  serverAdvancedButton.addEventListener('click', () => showServerAdvanced(serverAdvanced.hidden));
  showServerAdvanced(advancedSet());

  const serverForm = el('div', { class: 'gen-server-form' }, [serverTable, serverAdvancedButton, serverAdvanced]);

  function updateTable() {
    serverRows.forEach(r => { r.hidden = isTournament(); });
    tournamentRows.forEach(r => { r.hidden = !isTournament(); });
    playersRow.hidden = !isTournament() || pairedBeforehand();

    joinTimeoutRow.hidden = !isTournament();
    joinTimeoutRow.querySelector('.gen-row-help').dataset.tip = joinTimeoutHelp(!pairedBeforehand());
    joinTimeoutSelect.value = String(state.tJoinTimeout);
    joinTimeoutSelect.hidden = !state.tJoinTimeoutOn;

    const serverListed = state.serverWho === 'accounts';
    serverWhoSelect.value = state.serverWho;
    serverWhoRow.classList.add('open');
    serverSecurityText.innerHTML = serverListed
      ? '<i class="fa-solid fa-check gen-secure"></i>Only your listed players - and your admins. <i class="fa-regular fa-circle-question gen-row-help" tabindex="0" data-tip="Every player proves who they are with an `Ed25519` signature, so nobody can join in their place."></i>'
      : 'Anyone who finds the server. A join password keeps strangers out.';
    [serverVerifyText, serverIdImage, serverRoster, serverNamesText].forEach(e => { e.hidden = !serverListed; });

    if (serverListed) {
      serverRoster.render();
    }
    pairingRow.classList.add('open');
    firstText.hidden = pairedBeforehand();

    // right under the list: what its nicknames are for
    nicknamesText.hidden = !pairedBeforehand();
    nicknamesText.innerHTML = verifiedByAccounts()
      ? 'Nicknames are only for your convenience:<br>participants may play under any other name.'
      : 'Players set these exact nicknames to be let in to the correct match.';
    // the same first line for all three - insecure with a warning, or secure with a check - so nothing below jumps
    insecureText.innerHTML = verifiedByAccounts()
      ? '<i class="fa-solid fa-check gen-secure"></i>Secure, also over the internet. <i class="fa-regular fa-circle-question gen-row-help" tabindex="0" data-tip="Every player proves who they are with an `Ed25519` signature, so nobody can join in their place."></i>'
      : '<i class="fa-solid fa-triangle-exclamation gen-insecure"></i>Insecure, but enough for a LAN.';

    const size = `${state.tTeamSize}v${state.tTeamSize}`;
    firstText.innerHTML = `Players join <strong>any ${size} server</strong> they want <em>in the first round</em>.<br>They can use <strong>any nicknames</strong> they like.<br>In later rounds, they will be paired automatically.`;

    verifyText.innerHTML = 'Every participant must send you their account id.<br>Account ids are public - safe to share.<br>In the game: <code>Settings → Account → Copy account id</code>:';
    verifyText.hidden = !verifiedByAccounts();
    tournamentIdImage.hidden = !verifiedByAccounts();
    idsLabel.hidden = !verifiedByAccounts();
    idsText.hidden = !verifiedByAccounts();

    if (document.activeElement !== idsText) {
      idsText.value = state.tIdsText;
    }

    const verified = byAccounts();
    passwordRow.classList.toggle('gen-row-disabled', verified);
    passwordRow.querySelectorAll('input').forEach(i => { i.disabled = verified; });
    passwordNote.hidden = !verified;
    passwordRow.querySelector('.gen-row-ctl input[type=text]').hidden = verified || !state.passwordOn;

    const maps = roundMaps();
    mapsRow.show(maps.join(' <span class="gen-arrow">→</span> '), JSON.stringify(maps) === JSON.stringify(defaultRoundMaps()));

    cycleRow.show(
      state.cycle.length
        ? state.cycle.join(' <span class="gen-arrow">→</span> ') + (state.cycle.length > 1 ? `<span class="gen-summary-tag">${state.cycleRandom ? 'random order' : 'in order'}</span>` : '')
        : 'de_cyberaqua only',
      cycleIsDefault()
    );

    syncBotQuota();

    botsRow.show(
      state.bots ? `${state.botQuotaOn ? `${state.botQuota} ${state.botQuota > 1 ? 'bots' : 'bot'}` : 'On'} · ${botDifficultyText()}` : 'Off',
      botsAtDefault()
    );

    botDetails.hidden = !state.bots;
    botQuotaSlider.hidden = !state.botQuotaOn;
    botDifficultySelect.value = state.botDifficulty;
    botCountSelect.value = state.botQuotaOn ? 'fixed' : 'map';
    botDifficultySelect.querySelector('option[value=PROGRESSIVE]').disabled = state.botQuotaOn;

    portsRow.show(
      `${portSpan(state.port)} UDP` + (state.browser ? `, ${portSpan(state.webPort)} UDP` : '') + (pageOn() ? `, ${pagePort()} TCP` : ''),
      state.port === 8412 && state.webPort === 9000 && !state.tPagePort
    );

    tableWebPort.hidden = !state.browser;
    if (document.activeElement !== tablePagePort) {
      tablePagePort.value = String(pagePort());
    }

    tablePagePort.hidden = !pageOn();
    tablePageHead.style.display = pageOn() ? '' : 'none';
    // three columns with a tournament's results page, two without - each port under its own name
    tablePagePort.parentElement.classList.toggle('with-page', pageOn());
    document.querySelectorAll('.gen-page-port').forEach(e => { e.textContent = String(pagePort()); });
    tableWebHead.style.visibility = state.browser ? '' : 'hidden';

    adminRow.classList.toggle('open', adminWarning.style.display !== 'none' && adminWarning.textContent !== '');
  }

  setupListeners.push(() => {
    refreshInputs();
    cycleBox.refresh();
  });

  /*
    Not a login form: keep password managers (LastPass, 1Password, Bitwarden...) and autofill out of it -
    they jump at the "Password" field and the fields next to it.
  */
  [serverForm].forEach(f => f.querySelectorAll('input, textarea').forEach(i => {
    i.setAttribute('autocomplete', 'off');
    i.setAttribute('data-lpignore', 'true');
    i.setAttribute('data-1p-ignore', 'true');
    i.setAttribute('data-bwignore', 'true');
    i.setAttribute('data-form-type', 'other');
  }));

  /*
    A plain box, not a <form>: password managers take a form with a "password" in it for a login and fill
    the fields around it (LastPass did, into the tournament's Players).
  */
  const formRoot = el('div', { class: 'gen-settings' }, [serverForm]);

  /*
    The settings first, then what they make - generated live, under a line that says so.
  */

  function makeStep(title, body, generated = false) {
    const titleEl = el('span', { class: 'gen-step-title', text: title });
    const head = el('div', { class: 'gen-step-head' }, [titleEl]);
    const wrap = el('div', { class: 'gen-step' + (generated ? ' generated' : '') + (title ? '' : ' untitled') }, [
      head,
      el('div', { class: 'gen-step-body' }, [body])
    ]);

    if (!title) {
      head.remove();
    }

    return { el: wrap, title: titleEl, body: wrap.lastChild };
  }

  const steps = {
    before: makeStep('Your setup commands', beforeBlock, true),
    configure: makeStep('', formRoot),
    config: makeStep('Your config', configResults, true),
    secret: makeStep('Your private config', secretResults, true),
    // under the setup commands with its checkbox - toggling it changes nothing above
    service: makeStep('Your service file', serviceResults, true),
    firewall: makeStep('Your firewall commands', firewallResults, true),
    start: makeStep('Your startup command', startBlock, true),
    check: makeStep('Check that it works', checkBlock)
  };

  const generatedLine = el('div', { class: 'gen-generated' }, [
    el('div', { class: 'gen-generated-line', html: '<span><i class="fa-solid fa-arrow-down"></i>Your configs<i class="fa-solid fa-arrow-down"></i></span>' }),
    el('div', { class: 'gen-generated-sub', text: 'Generated live from the settings above' })
  ]);

  mount.appendChild(steps.configure.el);
  mount.appendChild(generatedLine);

  // how it runs - AppImage, Docker compose, docker run - changes only what is generated: its tabs go under the line
  subtabRows.forEach(r => mount.appendChild(r));

  // in the place of the tabs and what they show, while anything is wrong
  const errorBox = el('div', { class: 'gen-errors' });
  errorBox.hidden = true;
  mount.appendChild(errorBox);
  steps.check.el.classList.add('gen-check-step');

  // the whole profile in one link
  const linkButton = el('button', { type: 'button', class: 'gen-link-button', title: 'Every setting above in one link - bookmark it or send it. Left out: passwords, webhooks, admins, and how your machine runs it (service, FUSE).' });
  const linkLabel = '<i class="fa-solid fa-link"></i>Copy a link to this profile';
  linkButton.innerHTML = linkLabel;

  linkButton.addEventListener('click', () => {
    const shown = () => {
      linkButton.innerHTML = '<i class="fa-solid fa-check"></i>Link copied';
      linkButton.classList.add('copied');

      setTimeout(() => {
        linkButton.innerHTML = linkLabel;
        linkButton.classList.remove('copied');
      }, 1500);
    };

    navigator.clipboard.writeText(profileLink()).then(shown, () => prompt('The link to this profile:', profileLink()));
  });

  // over YOUR CONFIGS: it's the settings above, not what they make
  generatedLine.before(el('div', { class: 'gen-link-row' }, [linkButton]));
  [steps.config, steps.secret, steps.before, steps.service, steps.firewall, steps.start, steps.check].forEach(st => mount.appendChild(st.el));


  const ACCOUNT_ID = /^(steam_\d{17}|0x[0-9a-f]{64}|key_[0-9a-f]{64}|[0-9a-f]{64}|crazygames_\S+)$/i;

  // 0x<key>, key_<key> and the bare key are one account - as the game's normalize_account_id
  const sameAccount = id => /^(0x|key_)?[0-9a-f]{64}$/i.test(id) ? 'key_' + id.toLowerCase().replace(/^(0x|key_)/, '') : id;

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

    // an open first round has a server for every pair of the bracket - nobody knows the byes beforehand
    if (!pairedBeforehand()) {
      return { teams, byes, firstRound: size / 2, servers: size / 2 };
    }

    return { teams, byes, firstRound, servers: Math.max(1, firstRound, secondRound) };
  }

  function tournamentMatches() {
    return tournamentBracket().servers;
  }

  // only casual servers for now - a ranked one counts on the leaderboards only when official
  function instanceCount() {
    return isTournament() ? tournamentMatches() : Math.max(1, state.casual);
  }

  /*
    An argument as the shell takes it as it is: in single quotes, nothing in them expanded ($, `, !, \).
    systemd's ExecStart has its own rules: double quotes with \ and " escaped, $ and % doubled.
  */

  const shellQuote = v => /^[A-Za-z0-9_.,:\/=+-]+$/.test(v) ? v : "'" + v.replace(/'/g, "'\\''") + "'";
  const systemdQuote = v => /^[A-Za-z0-9_.,:\/=+-]+$/.test(v) ? v : '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '$$$$').replace(/%/g, '%%') + '"';

  // the open round's join timeout as written: nothing for the default 10 minutes
  const joinTimeoutValue = () => {
    if (!isTournament()) {
      return '';
    }

    if (!state.tJoinTimeoutOn) {
      return 'off';
    }

    return state.tJoinTimeout === 10 ? '' : String(state.tJoinTimeout);
  };

  // the tournament as command line flags (the AppImage) or environment variables (Docker)
  function tournamentFlags(quoted = shellQuote) {
    const out = [];

    if (pairedBeforehand()) {
      // the teams in one argument: "alice, bob; carol, dave"
      out.push(`--tournament-teams ${quoted(teamsArgument('; '))}`);
    }
    else {
      out.push(`--tournament ${state.tPlayers}`);

      if (state.tTeamSize > 1) {
        out.push(`--tournament-team-size ${state.tTeamSize}`);
      }
    }

    if (isTournament()) {
      const list = roundMaps().map(withMode).join(',');
      out.push(`--tournament-arenas ${quoted(list)}`);
    }

    if (isTournament() && !state.tPage) {
      out.push('--tournament-page off');
    }
    else if (isTournament() && state.tPagePort) {
      out.push(`--tournament-page ${state.tPagePort}`);
    }

    const timeout = joinTimeoutValue();

    if (timeout) {
      out.push(`--tournament-join-timeout ${timeout}`);
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

    if (!isTournament()) {
      server.server_name = state.name || 'My server';
    }

    // the default arena needs no line
    if (!isTournament() && startArena() !== 'de_cyberaqua') {
      server.arena = startArena();
    }

    if (mode && !isTournament()) {
      server.game_mode = mode;
    }

    // no bots: a quota of 0; a number set: that number; otherwise the arena's own
    if (!isTournament() && !state.bots) {
      server.bot_quota = [0];
    }
    else if (!isTournament()) {
      if (state.botQuotaOn) {
        server.bot_quota = [state.botQuota];
      }

      if (state.botDifficulty !== 'PROGRESSIVE') {
        server.bot_difficulty = state.botDifficulty;
      }
    }

    // server_private goes into its own file - the config can be shown to anyone
    const secrets = {};

    if (ids.length) {
      secrets.admin_profiles = ids.map(account => ({ account, rcon: 'MASTER_RCON' }));
    }

    if (password()) {
      secrets.server_password = password();
    }

    if (serverByAccounts()) {
      secrets.allowed_accounts = state.allowedPlayers.map(p => p.id);
    }

    if (!isTournament() && state.casual !== 1) {
      config.instances = { casual: state.casual };
    }

    // a tournament plays its own arenas, round by round
    if (cycleOn()) {
      server.cycle = 'LIST';
      server.cycle_list = state.cycle.map(withMode);

      if (!state.cycleRandom) {
        server.cycle_randomize_order = false;
      }
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
      server.daily_autoupdate_hour = hourText(state.updateHour);
    }

    if (state.webhook) {
      secrets.discord_webhook_url = state.webhook;
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

    Object.assign(json, config);

    return {
      json: Object.keys(json).length ? json : null,
      secrets: Object.keys(secrets).length ? { server_private: secrets } : null
    };
  }

  /*
    Docker: every field of the generator as its own environment variable - never a file, never HYPERSOMNIA_CONFIG.
    Only what differs from the defaults is written.
  */

  const SECRET_VARS = ['HYPERSOMNIA_PASSWORD', 'HYPERSOMNIA_DISCORD_WEBHOOK'];

  /*
    A .env line: single quotes keep the value as it is. A value with ' in double quotes:
    \, " and $ escaped by \ (compose would expand $NAME there).
  */
  function envLine(k, v) {
    const quoted = v.includes("'") ? '"' + v.replace(/[\\"$]/g, c => '\\' + c) + '"' : `'${v}'`;
    return `${k}=${quoted}`;
  }

  // compose's secrets go into .env next to it - compose.yaml only names them
  function dotEnv() {
    const secret = dockerEnv().filter(([k]) => SECRET_VARS.includes(k));
    return secret.length ? secret.map(([k, v]) => envLine(k, v)).join('\n') : '';
  }

  function dockerEnv() {
    const env = isTournament() ? [] : [['HYPERSOMNIA_SERVER_NAME', state.name || 'My server']];
    const ids = adminIds();
    const put = (k, v) => env.push([k, v]);

    if (!isTournament() && startArena() !== 'de_cyberaqua') {
      put('HYPERSOMNIA_ARENA', withMode(startArena()));
    }

    if (cycleOn()) {
      put('HYPERSOMNIA_MAP_CYCLE', state.cycle.map(withMode).join(','));

      if (!state.cycleRandom) {
        put('HYPERSOMNIA_MAP_CYCLE_RANDOM', 'off');
      }
    }

    if (ids.length) {
      put('HYPERSOMNIA_ADMINS', ids.join(','));
    }

    if (password()) {
      put('HYPERSOMNIA_PASSWORD', password());
    }

    if (serverByAccounts()) {
      put('HYPERSOMNIA_ALLOWED_ACCOUNTS', state.allowedPlayers.map(p => p.id).join(','));
    }

    if (!isTournament() && state.slots !== 16) {
      put('HYPERSOMNIA_SLOTS', String(state.slots));
    }

    if (!isTournament() && !state.bots) {
      put('HYPERSOMNIA_BOT_QUOTA', '0');
    }
    else if (!isTournament()) {
      if (state.botQuotaOn) {
        put('HYPERSOMNIA_BOT_QUOTA', String(state.botQuota));
      }

      if (state.botDifficulty !== 'PROGRESSIVE') {
        put('HYPERSOMNIA_BOT_DIFFICULTY', state.botDifficulty);
      }
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
      put('HYPERSOMNIA_DAILY_UPDATE', hourText(state.updateHour));
    }

    if (state.timeZone && !isTournament()) {
      put('HYPERSOMNIA_TIME_ZONE', state.timeZone);
    }

    if (state.webhook) {
      put('HYPERSOMNIA_DISCORD_WEBHOOK', state.webhook);
    }

    if (pairedBeforehand()) {
      // a team per line, its players separated by commas
      put('HYPERSOMNIA_TOURNAMENT_TEAMS', teamsArgument('\n'));
      put('HYPERSOMNIA_TOURNAMENT_ARENAS', roundMaps().map(withMode).join(','));
    }
    else if (isTournament()) {
      put('HYPERSOMNIA_TOURNAMENT', String(state.tPlayers));

      if (state.tTeamSize > 1) {
        put('HYPERSOMNIA_TOURNAMENT_TEAM_SIZE', String(state.tTeamSize));
      }

      put('HYPERSOMNIA_TOURNAMENT_ARENAS', roundMaps().map(withMode).join(','));
    }

    if (isTournament() && !state.tPage) {
      put('HYPERSOMNIA_TOURNAMENT_PAGE', 'off');
    }
    else if (isTournament() && state.tPagePort) {
      put('HYPERSOMNIA_TOURNAMENT_PAGE', String(state.tPagePort));
    }

    if (joinTimeoutValue()) {
      put('HYPERSOMNIA_TOURNAMENT_JOIN_TIMEOUT', joinTimeoutValue());
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
      pageOn() ? `      - '${pagePort()}:${pagePort()}/tcp'` : null,
      state.browser ? `      - '${web}:${web}/udp'` : null,
      '    environment:'
    ].filter(line => line !== null);

    env.forEach(([k, v]) => {
      if (SECRET_VARS.includes(k)) {
        lines.push(`      ${k}: \${${k}}`);
      }
      // compose expands $NAME in compose.yaml: $$ is a $
      else if (v.includes('\n')) {
        lines.push(`      ${k}: |`);
        v.split('\n').forEach(l => lines.push('        ' + l.replace(/\$/g, '$$$$')));
      }
      else {
        lines.push(`      ${k}: ${JSON.stringify(v.replace(/\$/g, '$$$$'))}`);
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
      pageOn() ? `  --publish ${pagePort()}:${pagePort()}/tcp` : null,
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
      isTournament() ? tournamentFlags(systemdQuote) : ''
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


  // a tournament's live page: the first game port's number, over TCP
  const pageOn = () => isTournament() && state.tPage;

  // the results page's TCP port: its own if set, else the first game port's number
  const pagePort = () => state.tPagePort || state.port;

  function firewall() {
    const ufw = s => s.replace('-', ':');

    const web = state.browser;

    return [
      '# ufw (Ubuntu, Debian)',
      `sudo ufw allow ${ufw(portSpan(state.port))}/udp`,
      web ? `sudo ufw allow ${ufw(portSpan(state.webPort))}/udp` : null,
      pageOn() ? `sudo ufw allow ${pagePort()}/tcp` : null,
      '',
      '# firewalld (Fedora, RHEL)',
      `sudo firewall-cmd --permanent --add-port=${portSpan(state.port)}/udp`,
      web ? `sudo firewall-cmd --permanent --add-port=${portSpan(state.webPort)}/udp` : null,
      pageOn() ? `sudo firewall-cmd --permanent --add-port=${pagePort()}/tcp` : null,
      'sudo firewall-cmd --reload'
    ].filter(line => line !== null).join('\n');
  }

  // a path or a command in a hint: monospace with its own copy button
  function inline(text) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="gen-inline"><code>${escaped}</code><button type="button" class="gen-inline-copy" title="Copy"><i class="fa-regular fa-copy"></i></button></span>`;
  }

  /*
    What's wrong with the settings - nothing is generated until it's fixed, so nobody copies a broken config.
  */

  function configErrors() {
    const errors = [];
    const list = names => [...new Set(names)].join(', ');

    // every listed player with an account id of their own
    const accountErrors = players => {
      const account = p => sameAccount(p.id).toLowerCase();
      const ids = players.filter(p => p.id).map(account);
      const missing = players.filter(p => !p.id).map(p => p.n);
      const bad = players.filter(p => p.id && !ACCOUNT_ID.test(p.id)).map(p => p.n);
      const shared = players.filter(p => p.id && ids.indexOf(account(p)) !== ids.lastIndexOf(account(p))).map(p => p.n);

      if (missing.length) {
        errors.push(`Who gets in: no account id for: ${list(missing)}`);
      }

      if (bad.length) {
        errors.push(`Who gets in: not an account id for: ${list(bad)}`);
      }

      if (shared.length) {
        errors.push(`Who gets in: the same account id for: ${list(shared)}`);
      }
    };

    if (state.adminOn) {
      const ids = adminIds();
      const bad = ids.filter(id => !ACCOUNT_ID.test(id));

      if (!ids.length) {
        errors.push('Admin: paste your account id - or switch it off.');
      }
      else if (bad.length) {
        errors.push(`Admin: not an account id: ${list(bad)}`);
      }
    }

    if (state.passwordOn && !verifiedByAccounts() && !state.password.trim()) {
      errors.push('Join password: type it - or switch it off.');
    }

    if (state.webhook.trim() && !/^https:\/\/\S+$/.test(state.webhook.trim())) {
      errors.push('Discord webhook: a link starting with https://');
    }

    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

    if (!isTournament() && state.timeZone && zones.length && !zones.includes(state.timeZone)) {
      errors.push(`Time zone: "${state.timeZone}" isn't one - e.g. Europe/Berlin.`);
    }

    if (isTournament() && !pairedBeforehand() && state.tPlayers < 2 * state.tTeamSize) {
      errors.push(`Players: at least ${2 * state.tTeamSize} for ${state.tTeamSize}v${state.tTeamSize} - two teams.`);
    }

    const n = instanceCount();

    if (state.browser && state.port < state.webPort + n && state.webPort < state.port + n) {
      errors.push(`Ports: the game's ${portSpan(state.port)} and the browser players' ${portSpan(state.webPort)} overlap - move one of them.`);
    }

    if (pageOn() && pagePort() < 1024) {
      errors.push(`Results page: port ${pagePort()} needs root - pick 1024 or more.`);
    }

    if (pairedBeforehand()) {
      const teams = listedTeams();
      const names = [].concat(...teams);
      const twice = names.filter((n, i) => names.indexOf(n) !== i);
      const wrong = teams.filter(t => t.length !== state.tTeamSize);
      const size = `${state.tTeamSize} ${state.tTeamSize > 1 ? 'players' : 'player'}`;

      if (teams.length < 2) {
        errors.push('Who gets in: add players for at least 2 teams.');
      }

      if (wrong.length) {
        errors.push(`Who gets in: not ${size}: ${wrong.map(t => t.join(', ')).join(' / ')}`);
      }

      if (names.some(unusableNickname)) {
        errors.push(`Who gets in: can't be a nickname: ${list(names.filter(unusableNickname))}`);
      }

      if (twice.length) {
        errors.push(`Who gets in: listed more than once: ${list([...new Set(twice)])}`);
      }

      if (verifiedByAccounts()) {
        accountErrors([].concat(...filledTeams()).map(p => ({ n: p.n, id: tournamentIdOf(p.n) })));
      }
    }

    if (serverByAccounts()) {
      if (!state.allowedPlayers.length) {
        errors.push('Who gets in: add the players who may join - or let anyone in.');
      }

      accountErrors(state.allowedPlayers);
    }

    return errors;
  }

  function update() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    catch (e) {}

    // the address bar holds the profile as it is - a bookmark keeps it; no new history entry for every click
    // nothing set: the plain address
    const changed = changedFromDefaults();
    NOT_IN_LINK.forEach(k => { delete changed[k]; });

    const atDefaults = Object.keys(changed).length === 0 && (!defaultButton || currentSetup === defaultButton.dataset.setup);

    try {
      history.replaceState(null, '', atDefaults ? location.pathname : profileLink());
    }
    catch (e) {}

    const bad = adminIds().filter(id => !ACCOUNT_ID.test(id));
    adminWarning.textContent = bad.length
      ? `Not an account id: ${bad.join(', ')} - copy it from Settings → Account in the game (steam_ + 17 digits, or 0x + 64 characters).`
      : '';
    adminWarning.style.color = bad.length ? 'var(--red)' : '';
    adminWarning.style.display = bad.length ? '' : 'none';

    updatePairing();
    updateCheck();
    updatePortRows();
    updateTable();

    const n = instanceCount();
    const ports = state.browser ? `UDP ${portSpan(state.port)} and ${portSpan(state.webPort)}` : `UDP ${portSpan(state.port)}`;

    // what the ports are for - told in Setup the firewall
    const forWhat = isTournament() ? ' (one each per match server)' : n > 1 ? ' (one each per server)' : '';
    const page = pageOn() ? `, and TCP ${pagePort()} for the live results page` : '';

    // the config: every file of this setup, open at once
    configResults.innerHTML = '';
    secretResults.innerHTML = '';
    serviceResults.innerHTML = '';
    let serviceBox = null;

    outputsOf().filter(k => k !== 'firewall').forEach(k => {
      if (k === 'compose') {
        configResults.appendChild(resultBox({ file: 'compose.yaml', lang: 'yaml', text: compose(), hint: 'Save it in any folder - the startup command runs in that folder.' }));

        if (dotEnv()) {
          secretResults.appendChild(resultBox({
            file: '.env',
            lang: 'bash',
            text: dotEnv(),
            hint: `Next to compose.yaml - it fills in its \${...}. Restrict who can read the file: ${inline('chmod 600 .env')}`
          }));
        }
      }
      else if (k === 'run') {
        // nothing to copy: the command is the start - in Your startup command
      }
      else if (k === 'service') {
        serviceBox = resultBox({
          file: ownUser() ? '~/.config/systemd/user/hypersomnia.service' : '/etc/systemd/system/hypersomnia.service',
          lang: 'ini',
          text: serviceUnit(),
          hint: 'The service that starts the server with the machine.'
        });

        serviceResults.appendChild(serviceBox);
      }
      else {
        const { json, secrets } = buildSettings();

        if (secrets) {
          secretResults.appendChild(resultBox({
            file: privatePath(),
            lang: 'json',
            text: prettyJson(secrets),
            hint: 'Passwords, webhooks and admins - keep them out of the config you show to others. Restrict who can read the file:'
          }));

          secretResults.appendChild(resultBox({ lang: 'bash', text: privateChmod() }));
        }

        configResults.appendChild(resultBox({
          file: configPath(),
          lang: json ? 'json' : '',
          text: json ? prettyJson(json) : 'No server config required!',
          hint: json || secrets ? `Make its folder first: ${inline(configMkdir())}` : '',
          unneeded: !json
        }));
      }
    });

    firewallResults.innerHTML = '';
    firewallResults.appendChild(resultBox({
      lang: 'bash',
      text: firewall(),
      hint: `Open ${ports}${forWhat}${page} in the system firewall - and in your cloud provider's panel, if it has one.`
    }));

    // the tournament's round 1, under its own options
    const bracket = tournamentBracket();
    // with the teams set up beforehand, their preview already shows round 1
    // open: whoever waits alone when round 1 closes advances - the byes aren't known beforehand
    roundSummary.innerHTML = pairedBeforehand() ? '' : `<strong>Round 1:</strong> ${bracket.firstRound} ${bracket.firstRound > 1 ? 'servers' : 'server'}.`;

    const start = startText();

    steps.start.el.hidden = !start;

    // docker run has no config to copy - everything is in its command, under Your startup command
    steps.config.el.hidden = method() === 'run';
    startHint.innerHTML = method() === 'run' ? `If it's running already, ${inline('docker rm -f hypersomnia-server')} first.` : '';
    startHint.hidden = !startHint.innerHTML;
    fillStart(start);
    steps.service.el.hidden = !serviceBox;
    steps.secret.el.hidden = !secretResults.childElementCount;
    steps.secret.title.textContent = method() === 'compose' ? 'Your .env' : 'Your private config';
    updateFuseField(serviceBox);

    const errors = configErrors();
    const escaped = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    errorBox.hidden = errors.length === 0;
    errorBox.innerHTML = `<div class="gen-errors-title"><i class="fa-solid fa-triangle-exclamation"></i>Fix the errors in the settings first</div><ul>${errors.map(e => `<li>${escaped(e)}</li>`).join('')}</ul>`;
    mount.classList.toggle('gen-has-errors', errors.length > 0);
  }

  function startText() {
    return {
      run: dockerRun(),
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

  function separateUser() {
    return method() === 'service' && !ownUser();
  }

  function configPath() {
    return separateUser() ? '/opt/hypersomnia/user/conf.d/server.json' : '~/.config/Hypersomnia/user/conf.d/server.json';
  }

  function privatePath() {
    return configPath().replace(/server\.json$/, 'private.json');
  }

  // only the server reads it - as a separate user, it must own the file
  function privateChmod() {
    const path = privatePath();
    return separateUser() ? `sudo chown hypersomnia: ${path}\nsudo chmod 600 ${path}` : `chmod 600 ${path}`;
  }

  // conf.d is there only after the first start - made by hand to save the config before
  function configMkdir() {
    const folder = configPath().replace(/\/server\.json$/, '');
    return separateUser() ? `sudo -u hypersomnia mkdir -p ${folder}` : `mkdir -p ${folder}`;
  }

  function outputOf(kind) {
    return {
      compose: { title: 'compose.yaml', lang: 'yaml', text: () => compose() },
      run: { title: 'Start it with docker run', lang: 'sh', text: () => dockerRun() },
      json: {
        title: configPath(),
        lang: 'json',
        text: () => prettyJson(buildSettings().json || {})
      },
      service: {
        title: ownUser() ? '~/.config/systemd/user/hypersomnia.service' : '/etc/systemd/system/hypersomnia.service',
        lang: 'ini',
        text: () => serviceUnit()
      },
      firewall: { title: 'Your firewall commands', lang: 'sh', text: () => firewall() }
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

      const value = state[k];

      if (JSON.stringify(value) !== JSON.stringify(fallback)) {
        out[k] = value;
      }
    });

    return out;
  }

  function profileLink() {
    const changed = changedFromDefaults();
    NOT_IN_LINK.forEach(k => { delete changed[k]; });

    return location.origin + location.pathname + PROFILE_HASH + encodeProfile({ setup: currentSetup, state: changed });
  }

  function profileMarkdown() {
    const block = (title, lang, text) => `## ${title}\n\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    const parts = [`# ${isTournament() ? 'Hypersomnia tournament' : (state.name || 'My server')} - ${setupName()}\n`, 'Made with https://hypersomnia.io/generator\n', `Open these settings again (without the passwords, webhooks and admins): ${profileLink()}\n`];

    if (beforeText()) {
      parts.push(block(beforeTitle(), 'sh', beforeText()));
    }

    // in the order they are done: the setup, the files, the firewall, the start
    // a server.json of all defaults isn't needed - left out
    // docker run is in Your startup command
    outputsOf().filter(k => k !== 'firewall' && k !== 'run' && !(k === 'json' && !buildSettings().json)).forEach(k => {
      const o = outputOf(k);
      parts.push(k === 'json' ? `## ${o.title}\n\n\`\`\`sh\n${configMkdir()}\n\`\`\`\n\n\`\`\`json\n${prettyJson(buildSettings().json)}\n\`\`\`\n` : block(o.title, o.lang, o.text()));
    });

    // the secrets apart, as on the page
    const secrets = method() === 'compose' ? dotEnv() : (method() !== 'run' && buildSettings().secrets);

    if (method() === 'compose' && secrets) {
      parts.push(block('.env', 'bash', secrets));
      parts.push(block('Restrict who can read the file', 'sh', 'chmod 600 .env'));
    }
    else if (secrets) {
      // no server.json before it to make the folder
      if (!buildSettings().json) {
        parts.push(block('Make the config folder', 'sh', configMkdir()));
      }

      parts.push(block(privatePath(), 'json', prettyJson(secrets)));
      parts.push(block('Restrict who can read the file', 'sh', privateChmod()));
    }

    parts.push(block('Your firewall commands', 'sh', firewall()));

    if (startText()) {
      parts.push(block('Your startup command', 'sh', startText()));
    }
    // > only as \u003e - a "-->" in a value would end the comment
    parts.push(`<!-- ${PROFILE_MARK} ${JSON.stringify({ setup: currentSetup, state: changedFromDefaults() }).replace(/>/g, '\\u003e')} -->\n`);

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
      alert('Not instructions saved by the generator - it has no "' + PROFILE_MARK + '" line at the end.');
      return;
    }

    try {
      const saved = JSON.parse(m[1]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.state || {}));

      if (saved.setup) {
        localStorage.setItem(SETUP_KEY, saved.setup);
      }

      // without the profile in the link - it would win over the loaded one
      location.replace(location.pathname);
    }
    catch (e) {
      alert('The instructions could not be read: ' + e.message);
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

    // the page with no profile in the link - the defaults, by definition
    location.replace(location.pathname);
  }

  const profileFile = el('input', { type: 'file', accept: '.md,text/markdown,text/plain', hidden: 'hidden' });

  profileFile.addEventListener('change', () => {
    const f = profileFile.files[0];

    if (f) {
      f.text().then(loadProfile);
    }

    profileFile.value = '';
  });

  const profileButton = (icon, text, onClick, tooltip = '') => {
    const b = el('button', { type: 'button', html: `<i class="${icon}"></i>${text}` });

    if (tooltip) {
      b.title = tooltip;
    }

    b.addEventListener('click', onClick);
    return el('div', { class: 'btn' }, [b]);
  };

  const profileBar = el('div', { class: 'btn-group gen-profile-bar' }, [
    profileButton('fa-solid fa-download', 'Save profile to .md', saveProfile, 'Every step in one Markdown file - you can give it to your LLM. Unlike the link, it has the passwords, webhooks and admins.'),
    profileButton('fa-solid fa-upload', 'Load profile', () => profileFile.click(), 'From a .md saved here.'),
    profileButton('fa-solid fa-rotate-left', 'Reset to defaults', resetToDefaults),
    profileFile
  ]);

  // under everything
  mount.after(profileBar);

  updateBefore();
  updateCheck();
  /*
    Our own tooltips for everything on the page - the (?) and every button's title - shown at once, unlike the browser's.
    A title moves into data-tip the first time it's pointed at, so the browser's never shows next to ours.
  */
  const tooltip = el('div', { class: 'gen-tooltip' });
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  function showTip(target) {
    if (target.hasAttribute('title')) {
      target.dataset.tip = target.getAttribute('title');
      target.removeAttribute('title');
    }

    // `code` in a tip shows in monospace
    const escaped = target.dataset.tip.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // `code` in monospace, a new line where the text has one
    tooltip.innerHTML = escaped.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
    tooltip.hidden = false;

    const r = target.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left - 10, document.documentElement.clientWidth - tooltip.offsetWidth - 8));
    tooltip.style.left = `${left + window.scrollX}px`;
    tooltip.style.top = `${r.bottom + 8 + window.scrollY}px`;
  }

  const tipTarget = e => e.target.closest && e.target.closest('.gen-page [title], .gen-page [data-tip]');

  ['mouseover', 'focusin'].forEach(type => document.addEventListener(type, e => {
    const target = tipTarget(e);

    if (target) {
      showTip(target);
    }
  }));

  ['mouseout', 'focusout'].forEach(type => document.addEventListener(type, e => {
    if (tipTarget(e)) {
      tooltip.hidden = true;
    }
  }));

  // a click copies or removes - the tip's done its job
  document.addEventListener('click', () => { tooltip.hidden = true; });

  // update() places the FUSE field too - it knows the service file's box
  setupListeners.push(updateCheck);
  setupListeners.push(updateBefore);
  update();
})();
