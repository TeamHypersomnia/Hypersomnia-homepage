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
      return state.service !== 'off' ? 'service' : 'terminal';
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
    The secrets: in the browser's storage - in a saved profile or the instructions only when asked (askSecrets).
  */

  // account ids aren't secrets - the admins and the spectator stay in a shared profile
  const SECRET_KEYS = ['password', 'passwordOn', 'webhook', 'tResultsWebhook', 'telegramToken'];

  // a link to a setup or its group (e.g. /generator#tournament) opens it; otherwise the last one chosen
  const linkedSetup = (() => {
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

      // a line kept only for the layout (reservedLine) is never copied
      const copied = source.cloneNode(true);
      copied.querySelectorAll('.gen-no-copy').forEach(e => e.remove());
      copyText(source.dataset.copy || copied.textContent, button);
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
    // in a terminal, a systemd service as you, or as its own user
    service: 'off',
    // the game itself: speeds and zoom as in the game's server settings (logic_speed.h, zoom_override.h)
    ownGameSpeed: false,
    gameSpeed: 0.75,
    ownBulletSpeed: false,
    bulletSpeed: 0.75,
    ownZoom: false,
    // the game's own zoom out (BALANCE_ZOOM_OUT) - where the slider starts
    zoom: 0.7,
    friendlyFire: false,
    freezeTime: true,
    // map_cycle: [ "*" ] - every arena on the server's disk
    cycleAll: false,
    // the machine's firewall - in the profile, as how the server runs
    firewall: 'none',
    adminOn: false,
    spectatorOn: false,
    spectator: '',
    // the server list it's on: the official one by default
    serverListOn: true,
    serverList: 'masterserver.hypersomnia.io:8430',
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
    tName: '',
    tTeams: [],
    tIdsText: '',
    tVerify: 'nicknames',
    tJoinTimeoutOn: true,
    tJoinTimeout: 10,
    // how many others may watch each match - every place takes RAM on its server
    tSpectatorPlaces: 6,
    serverWho: 'anyone',
    allowedPlayers: [],
    webhook: '',
    telegramToken: '',
    telegramChannel: '',
    tResultsWebhook: ''
  };

  let state = Object.assign({}, defaults);

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    Object.assign(state, saved);

    // saved before the password had its switch
    if (saved.password && saved.passwordOn === undefined) {
      state.passwordOn = true;
    }
  }
  catch (e) {}

  /*
    Whatever a pasted profile or the browser's storage brought in is checked against the defaults - a profile is anyone's:
    a number out of its range or text where an arena or a port goes would end up in the commands and on the page.
  */

  function sanitizeState(raw) {
    const out = Object.assign({}, defaults);
    const ranges = { tJoinTimeout: [1, 30], tSpectatorPlaces: [0, 50], botQuota: [1, 16], port: [1024, 65000], webPort: [1024, 65000], tPagePort: [0, 65535], slots: [4, 26], casual: [1, 8], tPlayers: [2, 64], tTeamSize: [1, 5], updateHour: [0, 23.5] };
    const decimals = { gameSpeed: [0.5, 1], bulletSpeed: [0.5, 1], zoom: [0.5, 1.5] };
    const enums = { tPairing: ['first', 'beforehand'], tVerify: ['nicknames', 'accounts'], serverWho: ['anyone', 'accounts'], botDifficulty: BOT_DIFFICULTIES.map(d => d[0]), service: ['off', 'systemd', 'user'], firewall: ['none', 'ufw', 'firewalld'] };
    // no leading dot: never "." or ".." - a name goes into paths of the commands
    const arenaName = v => typeof v === 'string' && /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,63}$/.test(v);

    // a listed player: a nickname, and an account id that can only be one - nothing else gets in
    const player = p => p && typeof p === 'object' && typeof p.n === 'string' && p.n.trim() !== '' && p.n.length <= 40 && !/[\x00-\x1f\x7f]/.test(p.n)
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

      if (decimals[k]) {
        const [min, max] = decimals[k];

        if (typeof v === 'number' && Number.isFinite(v)) {
          out[k] = Math.max(min, Math.min(max, Math.round(v * 20) / 20));
        }
      }
      else if (ranges[k]) {
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
          out[k] = v.slice(0, 64).filter(Array.isArray).map(team => players(team.slice(0, 64))).filter(team => team.length > 0);
        }
      }
      else if (k === 'allowedPlayers') {
        out[k] = Array.isArray(v) ? players(v.slice(0, 256)) : [];
      }
      else if (Array.isArray(d)) {
        if (Array.isArray(v)) {
          out[k] = v.slice(0, 64).filter(arenaName);
        }
      }
      else if (k === 'tIdsText') {
        if (typeof v === 'string') {
          out[k] = v.slice(0, 20000);
        }
      }
      else if (k === 'serverList') {
        if (typeof v === 'string' && /^[A-Za-z0-9.:\[\]-]{0,255}$/.test(v)) {
          out[k] = v;
        }
      }
      else if (k === 'timeZone') {
        if (typeof v === 'string' && /^[A-Za-z0-9_+\/-]{0,64}$/.test(v)) {
          out[k] = v;
        }
      }
      else if (typeof d === 'string') {
        // one line each - a newline would end a heredoc of the script (EOF, then a command); the admins one per line
        const allowed = k === 'admins' ? /^[^\u0000-\u0009\u000b-\u001f\u007f]*$/ : /^[^\u0000-\u001f\u007f]*$/;

        if (typeof v === 'string' && v.length <= 2000 && allowed.test(v)) {
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

  function textInput(key, placeholder, maxLength) {
    const i = el('input', { type: 'text', placeholder: placeholder || '' });

    if (maxLength) {
      i.maxLength = maxLength;
    }

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

  // a speed or a zoom: by 0.05, shown as 0.75x
  function decimalSlider(key, min, max) {
    const i = el('input', { type: 'range', min: String(min), max: String(max), step: '0.05', class: 'gen-slider' });
    const value = el('span', { class: 'gen-slider-value' });

    const sync = () => {
      i.value = state[key];
      value.textContent = `${Number(state[key]).toFixed(2)}x`;
      i.style.setProperty('--fill', `${(state[key] - min) / (max - min) * 100}%`);
    };

    i.addEventListener('input', () => {
      state[key] = Math.round(parseFloat(i.value) * 20) / 20;
      sync();
      update();
    });

    sync();
    refreshers.push(sync);
    return el('div', { class: 'gen-slider-row' }, [value, i]);
  }

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

  // a text box that suggests the matching time zones as you type (a datalist - the browser filters it)
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

    // every arena on the server's disk ("*"): no list to pick from
    const allCheck = el('input', { type: 'checkbox' });
    allCheck.checked = state.cycleAll;
    allCheck.addEventListener('change', () => { state.cycleAll = allCheck.checked; render(); update(); });

    const allOption = el('label', { class: 'gen-switch gen-random-option' }, [
      allCheck,
      el('span', { class: 'gen-switch-track' }),
      document.createTextNode('All arenas on the server\'s disk')
    ]);

    /*
      "+ Add" among the cycle's chips: a click makes it a text field there, Enter adds the map as a chip of the cycle -
      one from the list below leaves the list, any other is a map of your own (Advanced: Add your own maps).
      Escape or leaving it empty: back to "+ Add".
    */

    let adding = false;
    const knownMaps = el('datalist', { id: 'gen-known-maps' });
    all.forEach(name => knownMaps.appendChild(el('option', { value: name })));

    function addChip() {
      if (!adding) {
        const c = el('button', { type: 'button', class: 'gen-chip gen-chip-add', html: '<i class="fa-solid fa-plus"></i>Add' });
        // focused at once - what's typed right after the click isn't lost
        c.addEventListener('click', () => {
          adding = true;
          render();
          chips.querySelector('.gen-chip-input').focus();
        });
        return c;
      }

      const input = el('input', { type: 'text', class: 'gen-chip-input', placeholder: 'map name, Enter', maxLength: 64, spellcheck: 'false', list: 'gen-known-maps' });
      const wrap = el('span', { class: 'gen-chip gen-chip-adding' }, [input]);

      const done = () => { adding = false; render(); };

      input.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          done();
          return;
        }

        if (e.key !== 'Enter') {
          return;
        }

        e.preventDefault();
        const name = input.value.trim();

        if (!name) {
          done();
          return;
        }

        // never "." or ".." - a name goes into paths of the commands
        if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,63}$/.test(name)) {
          wrap.classList.add('gen-bad');
          wrap.title = 'Letters, digits, _ . - only, not starting with .';
          return;
        }

        adding = false;
        set(state.cycle.includes(name) ? state.cycle : state.cycle.concat([name]));
      });

      input.addEventListener('blur', () => {
        if (!input.value.trim()) {
          done();
        }
      });

      return wrap;
    }

    const customHint = el('p', { class: 'gen-field-text gen-custom-hint', html: 'Not on hypersomnia.io? See <a href="#" class="gen-goto-maps">Advanced: Add your own maps</a>' });

    // what "all on disk" is at first - shown with it (the folder by the setup: syncAllNote)
    const allNote = el('p', { class: 'gen-field-text gen-all-note' });
    const selection = el('div', {}, []);
    const cycleList = el('div', {}, [chips]);

    const resetButton = el('button', { type: 'button', class: 'gen-reset', text: 'Reset to defaults' });
    resetButton.addEventListener('click', () => {
      state.cycleRandom = true;
      state.cycleAll = false;
      randomCheck.checked = true;
      allCheck.checked = false;
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

      chips.appendChild(addChip());

      allCheck.checked = state.cycleAll;
      randomOption.hidden = !state.cycleAll && state.cycle.length < 2;
      randomCheck.checked = state.cycleRandom;
      resetButton.hidden = cycleIsDefault();

      // all on disk: the whole selection goes
      selection.hidden = state.cycleAll;
      cycleList.hidden = state.cycleAll;
      allNote.hidden = !state.cycleAll;

      pool.innerHTML = '';
      all.filter(name => !state.cycle.includes(name)).forEach(name => {
        const b = el('button', { type: 'button', class: 'gen-pool-chip' + (official.has(name) ? ' official' : ''), html: `<i class="fa-solid fa-plus"></i>${name}` });
        b.addEventListener('click', () => set(state.cycle.concat([name])));
        pool.appendChild(b);
      });
    }

    render();
    const browse = browseArenasLink();
    /*
      From the general to the specific: all on disk or a list, in random order or not; the list; what to add to it - from
      hypersomnia.io, or a map of your own; then back to the default.
    */

    selection.replaceChildren(pool, el('div', { class: 'gen-cycle-links' }, [browse]), customHint, knownMaps);
    const box = el('div', {}, [el('div', { class: 'gen-cycle-options' }, [allOption, randomOption]), allNote, cycleList, selection, el('div', { class: 'gen-cycle-links' }, [resetButton])]);
    box.allNote = allNote;
    box.refresh = render;
    return box;
  }


  // a tournament opens a server per match and lets in only its players instead
  const casualInput = sliderInput('casual', 1, 8);

  const cycleBox = cyclePicker();

  const admins = el('input', { type: 'text', placeholder: 'your account id - 0x8aed41f2... or steam_7656119...' });
  admins.value = state.admins;
  admins.addEventListener('input', () => { state.admins = admins.value; update(); });

  const adminWarning = el('div', { class: 'gen-hint' });

  const advancedSet = () =>
    state.timeZone !== '' || state.webhook !== '' || state.telegramToken !== '' || state.telegramChannel !== '' || state.adminOn || state.spectatorOn || state.tResultsWebhook !== '' ||
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

  // "=" joins a nickname to its account id, "," and ";" separate the players and the teams, a control character
  // breaks a line - none can be in a nickname
  const unusableNickname = n => /[=;,\x00-\x1f\x7f]/.test(n);

  const playerEntry = p => verifiedByAccounts() && tournamentIdOf(p.n) ? `${p.n}=${tournamentIdOf(p.n)}` : p.n;

  /*
    The teams as the game reads them: a player per line, the teams apart by an empty line - in 1v1 a player per line.
    No commas to type; the same text in a variable above the startup command, in compose.yaml and in docker run.
  */

  // in single quotes: nothing in them is expanded - not even a "!" pasted into an interactive shell
  const singleQuoted = v => "'" + v.replace(/'/g, "'\\''") + "'";

  function teamsText() {
    const teams = filledTeams().map(t => t.map(playerEntry));
    const apart = teams.some(t => t.length > 1);
    return teams.map(t => t.join('\n')).join(apart ? '\n\n' : '\n');
  }

  const teamsVariable = () => `TEAMS=${singleQuoted(teamsText())}`;

  // the rounds' arenas the same way, one per line
  const arenasText = () => roundMaps().map(withMode).join('\n');
  const arenasVariable = () => `ARENAS=${singleQuoted(arenasText())}`;

  // what the startup command's variables are made of - above it
  // each apart by an empty line, and from the command
  const startVariables = () => isTournament()
    ? [pairedBeforehand() ? teamsVariable() : null, arenasVariable()].filter(Boolean).map(v => v + '\n\n').join('')
    : '';

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
            const slot = el('div', { class: 'gen-roster-bye-slot', 'data-bye-slot': String(t), 'data-first-pair': String(byes), 'data-tip': 'Drop a team here\nto make them play each other' });
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
    // no prototype: a nickname "constructor" or "toString" is just a nickname
    const out = Object.create(null);

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

  // a listed nickname without its line in the ids box gets one - "nick ", the id to paste after it
  const hasIdLine = n => n in idLines() || state.tIdsText.split('\n').some(l => l.trim() === n);

  /*
    The ids box follows the listed nicknames: a line with an id always stays (the id is what matters - its nickname
    may be an old one), a line without one only while its nickname is listed; the listed nicknames missing get a line.
    Typing "kurwa" in the teams leaves one "kurwa " line, not one for every letter.
  */

  function syncIdLines() {
    const listed = [].concat(...listedTeams()).filter(Boolean);
    const lines = state.tIdsText.split('\n').filter(line => {
      const l = line.trim();

      if (!l) {
        return false;
      }

      return listed.includes(l) || /^(.*\S)\s+(\S+)$/.test(l);
    });

    const missing = listed.filter(n => !lines.some(line => line.trim() === n || (/^(.*\S)\s+(\S+)$/.exec(line.trim()) || [])[1] === n));
    const rebuilt = lines.concat(missing.map(n => `${n} `)).join('\n');

    // nothing changed: the text stays as typed, its trailing spaces too
    if (rebuilt.replace(/\s+$/, '') !== state.tIdsText.replace(/\s+$/, '')) {
      state.tIdsText = rebuilt;
    }
  }

  // a player's "!": their nickname on a new line of the ids box, the cursor after it
  function focusIdLine(n) {
    if (!hasIdLine(n)) {
      state.tIdsText = (state.tIdsText.trim() ? state.tIdsText.replace(/\s*$/, '\n') : '') + `${n} `;
    }

    idsText.value = state.tIdsText;
    idsText.focus();
    idsText.setSelectionRange(idsText.value.length, idsText.value.length);
    update();
  }

  // under the ids' box: where they come from (with its screenshot), and why that's enough
  const idsWhereText = el('p', { class: 'gen-field-text', html: 'In the game: <code>Settings → Account → Copy account id</code>' });
  const idsPublicText = el('p', { class: 'gen-field-text' });

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

  function resultBox({ file = '', fileTip = 'Copy the path', lang = '', text = '', hint = '', unneeded = false }) {
    const code = el('code', { text });
    const box = el('div', { class: 'guide-code' + (file ? ' with-file' : '') + (unneeded ? ' unneeded' : '') }, [
      el('div', { class: 'guide-code-file' }, [
        el('code', { text: file }),
        el('button', { type: 'button', class: 'gen-inline-copy', title: fileTip, html: '<i class="fa-regular fa-copy"></i>' })
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

  // step by step, or all of it in one script - and the script's own choices: the firewall left alone by default,
  // most servers have the ports open
  // the single script first: one paste for most - the steps a click away
  let oneShot = true;

  // the profile's box is made last - update() runs before it's there
  let profileBoxReady = false;
  // the contents on the left - made last too
  let tocReady = false;
  const scriptOptions = { start: true, dataFolder: true };

  // the config's files, and the firewall - remade on every change
  const configResults = el('div');
  const serviceResults = el('div');
  const secretResults = el('div');
  const firewallResults = el('div');
  const mapsAddResults = el('div');
  const keyBackupResults = el('div');
  const keySwapResults = el('div');
  const keyPublicResults = el('div');
  const playersKeyResults = el('div');

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

    // off the list: only at its own address
    if (!state.serverListOn) {
      return `Your tournament's results page:<br><code>http://&lt;your server&gt;:${pagePort()}/</code><br><br>`;
    }

    return `Within a minute your matches are on:<br><a href="/servers" target="_blank">hypersomnia.io/servers<i class="fa-solid fa-arrow-up-right-from-square gen-ext"></i></a><br>with <span class="gen-results-tag"><i class="fa-solid fa-trophy"></i> Results</span> next to them - your tournament's results page:<br><code>http://&lt;your server&gt;:${pagePort()}/</code><br><br>`;
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
    else if (!state.serverListOn) {
      checkText.innerHTML = 'Players who copy your line (above) find your server under <code>Favorites</code> in <code>Browse servers</code>.<br><br>Nobody can join?<br>Open the ports - see ' + (oneShot ? '<code>Firewall</code> in the script\'s options above.' : '<code>Your firewall commands</code> above.');
      checkImage.src = '/assets/images/generator/server_browser.png?t=2';
      checkImage.alt = 'Your server in Browse servers';
    }
    else {
      checkText.innerHTML = 'Within a minute your server is on:<br><a href="/servers" target="_blank">hypersomnia.io/servers<i class="fa-solid fa-arrow-up-right-from-square gen-ext"></i></a><br>and in <code>Browse servers</code> in the game.<br><br>On the list but nobody can join?<br>Open the ports - see ' + (oneShot ? '<code>Firewall</code> in the script\'s options above.' : '<code>Your firewall commands</code> above.');
      checkImage.src = '/assets/images/generator/server_browser.png?t=2';
      checkImage.alt = 'Your server in Browse servers';
    }
  }

  /*
    What to do once before the config: the executable, or Docker's data folder.
  */

  const BEFORE = {
    // downloaded next to it, then renamed over it - a running server keeps its file (a download into it: "Text file busy")
    terminal: 'wget -O Hypersomnia-Headless.AppImage.new \\\n  https://hypersomnia.io/builds/latest/Hypersomnia-Headless.AppImage\nchmod +x Hypersomnia-Headless.AppImage.new\nmv -f Hypersomnia-Headless.AppImage.new Hypersomnia-Headless.AppImage',
    service: 'cd ~\nwget -O Hypersomnia-Headless.AppImage.new \\\n  https://hypersomnia.io/builds/latest/Hypersomnia-Headless.AppImage\nchmod +x Hypersomnia-Headless.AppImage.new\nmv -f Hypersomnia-Headless.AppImage.new Hypersomnia-Headless.AppImage\nmkdir -p ~/.config/systemd/user',
    // the same, the server running as its own user
    // its home is only its own (700) - no cd into it, the paths in full
    serviceUser: 'sudo useradd --system --create-home --home-dir /opt/hypersomnia hypersomnia\nsudo chmod 700 /opt/hypersomnia\nsudo -u hypersomnia wget -O /opt/hypersomnia/Hypersomnia-Headless.AppImage.new \\\n  https://hypersomnia.io/builds/latest/Hypersomnia-Headless.AppImage\nsudo chmod +x /opt/hypersomnia/Hypersomnia-Headless.AppImage.new\nsudo -u hypersomnia mv -f /opt/hypersomnia/Hypersomnia-Headless.AppImage.new /opt/hypersomnia/Hypersomnia-Headless.AppImage',
    compose: 'sudo mkdir -p /opt/hypersomnia\nsudo chown 999:999 /opt/hypersomnia',
    run: 'sudo mkdir -p /opt/hypersomnia\nsudo chown 999:999 /opt/hypersomnia'
  };

  const beforeCode = el('code');

  // in a terminal, or a systemd service - as you, or as its own user (a VPS of its own)
  const SERVICE_NOTES = {
    off: 'runs in this terminal',
    systemd: 'starts with the machine',
    user: 'everything in /opt/hypersomnia'
  };

  const serviceSelect = el('select', {}, [
    el('option', { value: 'off', text: 'Off' }),
    el('option', { value: 'systemd', text: 'systemd' }),
    el('option', { value: 'user', text: 'systemd, own user' })
  ]);

  serviceSelect.value = state.service;
  const serviceNote = el('span', { class: 'gen-switch-note' });

  serviceSelect.addEventListener('change', () => {
    state.service = serviceSelect.value;
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

  // a label, its combo box and a note - the script's firewall the same
  const selectRow = (label, select, note) => el('label', { class: 'gen-select-row' }, [el('span', { text: label }), select, note].filter(Boolean));
  const serviceOption = selectRow('Service', serviceSelect, serviceNote);

  // the AppImage's executable, or Docker's data folder
  const beforeTitle = () => 'Your setup commands';

  const beforeBlock = el('div', { class: 'gen-before-box' }, [
    serviceOption,
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
    const key = method() === 'service' && state.service === 'user' ? 'serviceUser' : method();
    const m = method();

    // the config's folder too, when there's a config: conf.d is there only after the first start
    const { json, secrets } = m === 'terminal' || m === 'service' ? buildSettings() : {};
    const folder = json || secrets ? '\n' + configMkdir() : '';

    return (BEFORE[key] || '') + folder;
  }

  function updateBefore() {
    steps.before.title.textContent = beforeTitle();
    serviceOption.hidden = currentSetup !== 'server-appimage';
    serviceSelect.value = state.service;
    serviceNote.textContent = SERVICE_NOTES[state.service];
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
    return !state.cycleAll && JSON.stringify(state.cycle) === JSON.stringify(defaults.cycle) && state.cycleRandom;
  }

  function browseArenasLink() {
    return el('a', { class: 'gen-browse', href: '/arenas', target: '_blank', html: '<i class="fa-solid fa-arrow-up-right-from-square"></i>Browse all arenas' });
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

  const botsRow = foldRow('Bots', 'Bots fill the teams\nwhen players are missing.\n\nMap default: as many as the arena says.\n\nProgressive: they get harder\nas the players do better.\nOnly with the map default.', el('div', { class: 'gen-bots' }, [
    switchInput('bots', () => {}, 'fill the teams with bots'),
    botDetails
  ]));

  /*
    Game vars: the game speed, the bullets' (following the game's unless set apart), the zoom (the map's unless set),
    friendly fire, freeze time. Folded: only what differs from the defaults.
  */

  const gameVarsAtDefault = () =>
    !state.ownGameSpeed && !state.ownBulletSpeed && !state.ownZoom && !state.friendlyFire && state.freezeTime
  ;

  // off: the game's own default (0.75x)
  const effectiveGameSpeed = () => state.ownGameSpeed ? state.gameSpeed : defaults.gameSpeed;
  const effectiveBulletSpeed = () => state.ownBulletSpeed ? state.bulletSpeed : effectiveGameSpeed();
  const speedText = v => `${Number(v).toFixed(2)}x`;

  function gameVarsSummary() {
    if (gameVarsAtDefault()) {
      return 'All defaults';
    }

    return [
      state.ownGameSpeed ? `Game speed ${speedText(state.gameSpeed)}` : null,
      state.ownBulletSpeed ? `Bullet speed ${speedText(state.bulletSpeed)}` : null,
      state.ownZoom ? `Zoom ${speedText(state.zoom)}` : null,
      state.friendlyFire ? 'Friendly fire' : null,
      !state.freezeTime ? 'No freeze time' : null
    ].filter(Boolean).join(' · ');
  }

  const gameVarsRows = [];

  function gameVarsRow() {
    const original = el('span', { class: 'gen-original', html: '<i class="fa-solid fa-star"></i>Original Hypersomnia' });
    const gameDefault = el('span', { class: 'gen-switch-note', text: `the game's default: ${speedText(defaults.gameSpeed)}` });
    const gameSlider = decimalSlider('gameSpeed', 0.5, 1);
    const bulletFollows = el('span', { class: 'gen-switch-note' });
    const bulletSlider = decimalSlider('bulletSpeed', 0.5, 1);
    const zoomSlider = decimalSlider('zoom', 0.5, 1.5);

    const line = (label, controls, help) => el('div', { class: 'gen-sub-row' }, [
      el('span', { class: 'gen-sub-label' }, [document.createTextNode(label)].concat(help ? [el('i', { class: 'fa-regular fa-circle-question gen-row-help', 'data-tip': help, 'aria-label': help, tabindex: '0' })] : [])),
      el('span', { class: 'gen-sub-ctl' }, controls)
    ]);

    const row = foldRow('Game vars', 'The game itself: its speed,\nthe bullets\', the zoom, friendly fire\nand freeze time.', el('div', { class: 'gen-game-vars' }, [
      line('Game speed', [switchInput('ownGameSpeed', () => {}, ''), gameDefault, gameSlider, original], 'Slows down the entire game:\nmovement, physics, bullets, reloads, bots.\nFire rates and recoil stay the same.\n\nPlayers may change it with /speed.'),
      line('Bullet speed', [switchInput('ownBulletSpeed', () => {}, ''), bulletFollows, bulletSlider], 'Off: the same as the game speed.'),
      line('Zoom', [switchInput('ownZoom', () => {}, ''), el('span', { class: 'gen-switch-note gen-zoom-default', text: 'the map\'s own' }), zoomSlider], 'Less shows more of the map.\nOff: the map\'s own.'),
      line('Friendly fire', [switchInput('friendlyFire', () => {}, '')]),
      line('Freeze time', [switchInput('freezeTime', () => {}, '')], 'Off: rounds start right away.')
    ]));

    row.sync = () => {
      row.show(gameVarsSummary(), gameVarsAtDefault());
      // its place kept when not shown - the slider never moves
      original.style.visibility = effectiveGameSpeed() === 1 && effectiveBulletSpeed() === 1 ? '' : 'hidden';
      gameDefault.hidden = state.ownGameSpeed;
      gameSlider.hidden = !state.ownGameSpeed;
      bulletFollows.textContent = `same as the game: ${speedText(effectiveGameSpeed())}`;
      bulletFollows.hidden = state.ownBulletSpeed;
      bulletSlider.hidden = !state.ownBulletSpeed;
      row.querySelector('.gen-zoom-default').hidden = state.ownZoom;
      zoomSlider.hidden = !state.ownZoom;
    };

    gameVarsRows.push(row);
    return row;
  }

  const serverGameVarsRow = gameVarsRow();
  const tournamentGameVarsRow = gameVarsRow();

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

  // the game's port outside 8412-8415: the game finds the servers on its network by itself - only on these
  const portWarning = el('p', { class: 'gen-port-warning', html: '<i class="fa-solid fa-triangle-exclamation"></i>For a LAN party, consider 8412-8415:<br>the game finds such servers on the local network by itself.' });

  const portsRow = foldRow('Ports', 'Change them only if 8412 or 9000\nis taken on this machine.', el('div', { class: 'gen-ports' }, [
    el('span', { class: 'gen-ports-head', html: '<i class="fa-solid fa-gamepad"></i>Game' }),
    tableWebHead,
    tablePageHead,
    tablePort,
    tableWebPort,
    tablePagePort,
    portWarning
  ]));

  const adminRow = revealRow('Admin', 'adminOn', admins, 'Your account id - in the game: `Settings → Account`.\n\nManage the server in-game: maps, bans...\n\nIn a tournament:\n- watch any match,\n- close round 1 when not everyone came,\n- decide a match someone doesn\'t come to.');
  adminRow.appendChild(el('div', { class: 'gen-row-editor gen-row-note' }, [adminWarning]));

  const spectatorInput = textInput('spectator', 'its account id - 0x8aed41f2... or steam_7656119...');
  /*
    The server list: on hypersomnia.io/servers and in Browse servers - and what only it gives: browser players come
    through it (its WebRTC signalling), their join links, a tournament's page linked from it. Another address: your own.
  */

  const DEFAULT_SERVER_LIST = 'masterserver.hypersomnia.io:8430';

  const serverListInput = textInput('serverList', DEFAULT_SERVER_LIST);
  const serverListDefault = el('button', { type: 'button', class: 'gen-small-button', html: '<i class="fa-solid fa-rotate-left"></i>Back to default' });

  serverListDefault.addEventListener('click', () => {
    state.serverList = DEFAULT_SERVER_LIST;
    serverListInput.value = DEFAULT_SERVER_LIST;
    update();
  });

  // browser players join only through the server list
  const browserOn = () => state.browser && state.serverListOn;
  const browserRow = settingRow('Browser players', [switchInput('browser', () => {}, 'from <a href="https://play.hypersomnia.io" target="_blank">play.hypersomnia.io<i class="fa-solid fa-arrow-up-right-from-square gen-ext"></i></a>')]);

  const serverListWarning = el('p', { class: 'gen-port-warning', html: '<i class="fa-solid fa-triangle-exclamation"></i>Browser players can\'t join - and only those who know its address find the server.' });

  const serverListRow = settingRow(
    'Server list',
    [switchInput('serverListOn', () => {}), serverListInput],
    'Off: only for privacy -\nyour server isn\'t shown to anyone.\n\nOn (recommended):\n- anyone finds it on hypersomnia.io/servers\n  and in Browse servers in the game,\n- players can join right from their web browser,\n  no download,\n- you can send a link that takes\n  your friends straight into your server,\n- a tournament\'s live results page\n  is shown next to its matches,\n- a new server is announced on\n  Hypersomnia\'s Discord and Telegram.\n\nAnother address: only if you run\nyour own server list.'
  );

  serverListRow.appendChild(el('div', { class: 'gen-row-editor' }, [serverListWarning, serverListDefault]));

  const serverListAddress = () => state.serverListOn ? state.serverList.trim() : '';
  const serverListChanged = () => serverListAddress() !== DEFAULT_SERVER_LIST;

  function updateServerList() {
    serverListInput.hidden = !state.serverListOn;
    serverListWarning.hidden = state.serverListOn;
    serverListDefault.hidden = !state.serverListOn || !serverListChanged();
    serverListRow.classList.toggle('open', !serverListWarning.hidden || !serverListDefault.hidden);
  }

  const spectatorRow = revealRow('Spectator', 'spectatorOn', spectatorInput, 'An account that only watches:\na caster, a bot streaming the matches.\n\nAlways gets in:\n- a place kept for it on a full server,\n- no password,\n- into ranked and tournament matches\n  being played.\n\nNever on a team.');

  /*
    What /tournament.json and the results webhook carry - the game's tournament_page.h as JSON, field for field.
  */

  function examplePayload(ongoing) {
    const p = (nickname, account) => ({ nickname, account });
    const alice = p('alice', 'steam_76561198012345678');
    const bob = p('bob', 'key_8aed41f2c0a3b6f1e9d7c5b3a1f0e2d4c6b8a0f1e3d5c7b9a1f2e4d6c8b0a2f4');
    const carol = p('carol', 'steam_76561198055556666');
    const dave = p('dave', 'key_c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5');
    const erin = p('erin', 'steam_76561198087654321');
    const frank = p('frank', 'key_3f9a2c7d1e5b8a4c6d0e9f2a1b7c3d5e8f0a2b4c6d8e1f3a5b7c9d0e2f4a6b8c');
    const gus = p('gus', 'steam_76561198011112222');
    const hal = p('hal', 'steam_76561198033334444');
    const ivy = p('ivy', 'steam_76561198077778888');
    const jo = p('jo', 'steam_76561198099990000');

    const done = (team_a, team_b, score_a, score_b) => ({ status: 'done', winner: 'a', team_a, team_b, score_a, score_b });

    // being played: the final, live on its server
    const final = ongoing
      ? { name: 'Final', state: 'PLAYING', arena: 'fy_minilab', matches: [{ status: 'live', winner: '', team_a: [alice, bob], team_b: [erin, frank], score_a: 9, score_b: 7, server_name: '[alice, bob] vs [erin, frank]', port: 8412 }], byes: [] }
      : { name: 'Final', state: 'PLAYED', arena: 'fy_minilab', matches: [done([alice, bob], [erin, frank], 16, 7)], byes: [] };

    return {
      name: state.tName.trim() || 'My Tournament',
      state: ongoing ? 'ONGOING' : 'FINISHED',
      winner_team: ongoing ? [] : [alice, bob],
      rounds: [
        final,
        { name: 'Semifinals', state: 'PLAYED', arena: 'de_cyberaqua', matches: [
          done([alice, bob], [carol, dave], 16, 14),
          { status: 'walkover', winner: 'a', team_a: [erin, frank], team_b: [gus, hal] }
        ], byes: [] },
        { name: 'Quarterfinals', state: 'PLAYED', arena: 'de_silo', matches: [done([carol, dave], [ivy, jo], 16, 11)], byes: [[alice, bob], [erin, frank], [gus, hal]] }
      ],
      config: {
        who_gets_in: 'listed accounts',
        team_size: 2,
        teams: 5,
        arenas: ['de_silo', 'de_cyberaqua', 'fy_minilab'],
        join_timeout_minutes: 10
      }
    };
  }

  // where the finished tournament's results are left on the machine - the same JSON the webhook gets
  function resultsFilePath() {
    if (method() === 'compose' || method() === 'run') {
      return '/opt/hypersomnia/tournament_results.json';
    }

    return separateUser() ? '/opt/hypersomnia/user/tournament_results.json' : '~/.config/Hypersomnia/user/tournament_results.json';
  }

  // checking the signature in Node.js - the webhook's request, or the endpoint fetched
  const VERIFY_KEY_LINES = [
    '',
    '// an Ed25519 public key in the form Node reads',
    'const publicKey = crypto.createPublicKey({',
    "  key: Buffer.from('302a300506032b6570032100' + serverKey, 'hex'),",
    "  format: 'der',",
    "  type: 'spki'",
    '});',
    '',
    'const genuine =',
    '  serverKey === YOUR_SERVER_KEY &&',
    "  crypto.verify(null, rawBody, publicKey, Buffer.from(signature, 'hex'));"
  ];

  const verifySnippet = endpoint => [
    "const crypto = require('crypto');",
    ''
  ].concat(endpoint ? [
    `const res = await fetch('${endpoint}');`,
    'const rawBody = Buffer.from(await res.arrayBuffer());',
    "const serverKey = res.headers.get('x-hypersomnia-server-key');",
    "const signature = res.headers.get('x-hypersomnia-signature');"
  ] : [
    '// rawBody: the request body exactly as it came, as a Buffer',
    "const serverKey = req.headers['x-hypersomnia-server-key'];",
    "const signature = req.headers['x-hypersomnia-signature'];"
  ]).concat(VERIFY_KEY_LINES).join('\n');

  /*
    The example JSON folded: config and every round - a click shows one, its "−" folds it back.
    Folded parts are "round<i>" and "config".
  */

  function payloadJson(ongoing, folded) {
    const payload = examplePayload(ongoing);

    folded.forEach(id => {
      if (id === 'config') {
        payload.config = '__FOLD_config__';
      }
      else {
        payload.rounds[parseInt(id.slice(5), 10)] = `__FOLD_${id}__`;
      }
    });

    const json = JSON.stringify(payload, null, 2);
    return ongoing ? json.replace('"state": "ONGOING",', '"state": "ONGOING", // FINISHED once it\'s over').replace('"winner_team": [],', '"winner_team": [], // its players once it\'s over') : json;
  }

  function foldPayload(box, ongoing) {
    const code = box.querySelector('pre code');
    const payload = examplePayload(ongoing);
    const ids = ['config'].concat(payload.rounds.map((r, i) => `round${i}`));
    const label = id => id === 'config' ? '{ … }' : `{ … ${payload.rounds[parseInt(id.slice(5), 10)].name} }`;
    const q = '(&quot;|")';

    // all folded at first - a click shows each
    const folded = new Set(ids);

    // the copy button copies the whole JSON, folded or not
    code.dataset.copy = payloadJson(ongoing, []);

    const button = (id, text, tip, cls) => `<button type="button" class="gen-json-fold${cls}" data-key="${id}" title="${tip}">${text}</button>`;

    const render = () => {
      code.textContent = payloadJson(ongoing, [...folded]);
      highlight(code, 'json');

      ids.forEach(id => {
        if (folded.has(id)) {
          const marker = new RegExp(`(<span[^>]*>)?${q}__FOLD_${id}__${q}(</span>)?`);
          code.innerHTML = code.innerHTML.replace(marker, button(id, label(id), 'Show it', ''));
        }
        else {
          // shown: a small button after its key (config) or its name (a round) folds it back
          const anchor = id === 'config'
            ? new RegExp(`((<span[^>]*>)?${q}config${q}(</span>)?(<span[^>]*>)?:(</span>)?)`)
            : new RegExp(`((<span[^>]*>)?${q}${payload.rounds[parseInt(id.slice(5), 10)].name}${q}(</span>)?)`);

          code.innerHTML = code.innerHTML.replace(anchor, `$1 ${button(id, '−', 'Hide it', ' gen-json-unfold')}`);
        }
      });

      code.querySelectorAll('.gen-json-fold').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.key;

        if (folded.has(id)) {
          folded.delete(id);
        }
        else {
          folded.add(id);
        }

        render();
      }));
    };

    render();
  }

  function showPayloadModal(title, intro, ongoing, file) {
    const json = payloadJson(ongoing, []);

    const payloadBox = resultBox({ file: file || '', fileTip: 'Copy', lang: 'json', text: json });
    foldPayload(payloadBox, ongoing);

    showModal(title, [
      el('p', { class: 'gen-field-text', html: intro }),
      el('div', { class: 'gen-modal-code' }, [
        payloadBox,
        el('p', { class: 'gen-field-text', html: `Signed by your server, so nobody else can ${ongoing ? 'pass off fake results as yours' : 'post fake results'}:<br><code>X-Hypersomnia-Server-Key</code> - its public key - what <code>--print-server-key</code> prints,<br><code>X-Hypersomnia-Signature</code> - Ed25519 of the body. To check it in Node.js:` }),
        resultBox({ lang: 'javascript', text: verifySnippet(ongoing ? file : '') })
      ].concat(ongoing ? [] : [
        el('h4', { class: 'gen-modal-subtitle', text: 'Alternatively' }),
        el('p', { class: 'gen-field-text', html: `The very same JSON, saved on the server once it's over:<br>${inline(resultsFilePath())}` })
      ]))
    ]);
  }

  /*
    A modal over the generator: its title, what's in it, closed by its X, Escape or a click beside it.
  */

  function showModal(title, children, fit = false) {
    const close = el('button', { type: 'button', class: 'gen-modal-close', 'aria-label': 'Close', html: '<i class="fa-solid fa-xmark"></i>' });
    const panel = el('div', { class: 'gen-modal' + (fit ? ' gen-modal-fit' : '') }, [close, el('h3', { text: title }), ...children]);
    const overlay = el('div', { class: 'gen-modal-overlay' }, [panel]);

    const dismiss = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };

    const onKey = e => {
      if (e.key === 'Escape') {
        dismiss();
      }
    };

    close.addEventListener('click', dismiss);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        dismiss();
      }
    });
    document.addEventListener('keydown', onKey);
    // inside the generator: its code snippets' look (font, colors) applies there
    mount.appendChild(overlay);
    close.focus();
    return dismiss;
  }

  const payloadButton = (label, title, intro, ongoing, file) => {
    const b = el('button', { type: 'button', class: 'gen-payload-button', text: label });
    b.addEventListener('click', () => showPayloadModal(title, intro, ongoing, file && file()));
    return b;
  };

  const resultsWebhookRow = settingRow('Results webhook', [
    textInput('tResultsWebhook', 'https://... - gets the results when it\'s over'),
    payloadButton('Show example payload', 'Results webhook', 'One <code>POST</code> when the tournament is over. Take only <code>"state": "FINISHED"</code> and <strong>deduplicate by tournament name</strong>:', false, () => 'Content-Type: application/json')
  ], 'The final results, POSTed once to this URL\n- e.g. to put them on your site.\n\nThe same JSON as the live results page\nserves at `/tournament.json`.');

  const pageExampleButton = payloadButton('Also has a JSON endpoint!', 'Live results page', 'What the page draws - for your own site or bot. At most 5 requests a second from one address.', true, () => `http://<your server>:${pagePort()}/tournament.json`);

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

  const pairingRow = settingRow('Who gets in', [pairingSelect], 'On a LAN, Anyone or Listed nicknames\nis enough: people there trust each other.');

  // however they join first: what it means for the players
  const firstText = el('p', { class: 'gen-field-text', html: 'Players join <strong>any server</strong> they want <em>in the first round</em>.<br>They can use <strong>any nicknames</strong> they like.<br>In later rounds, they will be paired automatically.' });

  // set up beforehand: the list and how it was understood - the rounds say it better than any explanation
  const nicknamesText = el('p', { class: 'gen-field-text' });
  // the first line under the choice, whichever lets anyone take a nickname
  const insecureText = el('p', { class: 'gen-field-text gen-security' });
  const spectateText = el('p', { class: 'gen-field-text', text: 'Players can spectate other matches after they finish.' });
  const pairingEditor = el('div', { class: 'gen-row-editor' }, [insecureText, firstText, teamsRoster, nicknamesText, spectateText]);
  pairingRow.appendChild(pairingEditor);

  const playersRow = settingRow('Players', [playersInput, roundSummary]);

  /*
    Join timeout: a match of any round that hasn't started by then is decided without it - the team that came wins,
    nobody: both out. With Anyone, round 1's servers close as if Close round 1 were clicked. The matches being played go on.
  */

  // with Anyone, round 1 has no teams to wait for - one sentence on what happens there instead
  const joinTimeoutHelp = anyone => 'How long a match waits for all its players,\ncounted from the round\'s first player.\n\nThen:\n- more players present: that team wins,\n- equal numbers: it starts as they are,\n- nobody came: both teams are out.' +
    (anyone ? '\n\nRound 1: a player left alone on a server goes on without playing.' : '') +
    '\n\nMatches being played are never touched.';

  const joinTimeoutSelect = el('select', {}, Array.from({ length: 30 }, (_, i) => el('option', { value: String(i + 1), text: `${i + 1} min` })));

  joinTimeoutSelect.addEventListener('change', () => {
    state.tJoinTimeout = parseInt(joinTimeoutSelect.value, 10);
    update();
  });

  const joinTimeoutRow = settingRow('Join timeout', [switchInput('tJoinTimeoutOn', () => {}), joinTimeoutSelect], joinTimeoutHelp(false));

  // without it, a match someone never comes to waits forever - unless an admin decides it
  const joinTimeoutAdminHint = el('p', { class: 'gen-field-text gen-hint', text: 'Consider setting an Admin (advanced options) - to decide matches someone doesn\'t come to.' });
  joinTimeoutRow.appendChild(el('div', { class: 'gen-row-editor' }, [joinTimeoutAdminHint]));

  /*
    Places to watch each match: the teams out or waiting watch the others. Every place is a connection the server
    allocates up front (about 4.4 MB of RAM, measured), and each one watching takes upload too.
  */

  const spectatorPlacesWarning = el('p', { class: 'gen-port-warning' });
  const spectatorPlacesRow = settingRow(
    'Extra spectator slots',
    [sliderInput('tSpectatorPlaces', 0, 50)],
    'How many others may watch each match:\nthe teams out or waiting.\n\nIts players always get in,\nthe admins and the spectator account too.'
  );

  // under the row, as the join timeout's hint
  spectatorPlacesRow.appendChild(el('div', { class: 'gen-row-editor' }, [spectatorPlacesWarning]));

  function updateSpectatorPlaces() {
    const n = state.tSpectatorPlaces;
    spectatorPlacesRow.classList.toggle('open', n > 6);
    spectatorPlacesWarning.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>About ${Math.round(n * 4.4)} MB of RAM on every match's server, taken up front - and upload for each one watching.`;
  }

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
  // under "Account ids are public": the accounts are the game's own keys - Steam is one way, not the only one
  const NO_STEAM_NEEDED = '<strong>You no longer need Steam to authenticate!</strong> <i class="fa-regular fa-circle-question gen-row-help" tabindex="0" data-tip="Each player\'s game makes its own key\non the first start: `Ed25519`,\nthe cryptography of SSH.\n\nThe account id is its public half.\n\nOn every join, the game signs\nwith the private half -\nnobody can join in their place.\n\nSteam players can use their\nSteam account too."></i>';

  const serverVerifyText = el('p', { class: 'gen-field-text', text: 'Every player must send you their account id.' });
  const serverWhereText = el('p', { class: 'gen-field-text', html: 'In the game: <code>Settings → Account → Copy account id</code>' });
  const serverIdImage = accountIdImage();
  const serverPublicText = el('p', { class: 'gen-field-text', html: NO_STEAM_NEEDED + '<br>Account ids are public - safe to share.' });
  const serverNamesText = el('p', { class: 'gen-field-text', html: 'Nicknames are only for your convenience:<br>players may play under any other name. Admins always get in.' });
  const serverWhoEditor = el('div', { class: 'gen-row-editor' }, [serverSecurityText, serverVerifyText, serverRoster, serverWhereText, serverIdImage, serverPublicText, serverNamesText]);
  const serverWhoRow = settingRow('Who gets in', [serverWhoSelect], 'Listed accounts:\nonly the players you list get in.\n\nEach proves their account,\nso nobody can join in their place.\n\nAnyone else sees:\n"This server lets in only its listed players".');
  serverWhoRow.appendChild(serverWhoEditor);

  /*
    Verify players by: their nicknames (anyone may take one - enough among friends on a LAN), or their accounts -
    a box for each player's account id, the nickname only shown.
  */

  const verifyText = el('p', { class: 'gen-field-text' });
  // where each participant copies theirs - dimmed as the other pictures, lit when pointed at
  // where the account id is in the game - a screenshot behind a button, not in the way
  function accountIdImage() {
    const button = el('button', { type: 'button', class: 'gen-small-button gen-shot-button', html: '<i class="fa-regular fa-image"></i>Screenshot' });

    button.addEventListener('click', () => showModal('Copy your account id', [
      el('p', { class: 'gen-field-text', html: 'In the game: <code>Settings → Account → Copy account id</code>' }),
      el('img', { class: 'guide-image gen-account-id-image', src: '/assets/images/generator/copy_account_id.png?t=3', alt: 'Settings → Account → Copy account id, in the game' })
    ], true));

    return el('div', { class: 'gen-shot-row' }, [button]);
  }
  const tournamentIdImage = accountIdImage();
  // listed accounts: the teams first, then where the ids come from and their box
  idsPublicText.innerHTML = NO_STEAM_NEEDED + '<br>Account ids are public - safe to share.';
  // apart from what's above: the ids' part ends there
  nicknamesText.classList.add('gen-after-gap');
  serverNamesText.classList.add('gen-after-gap');
  [verifyText, idsText, idsWhereText, tournamentIdImage, idsPublicText].forEach(e => pairingEditor.insertBefore(e, nicknamesText));
  verifyText.classList.add('gen-after-gap');

  const defaultRoundMaps = () => roundMaps().map((_, i) => i % 2 === 0 ? 'de_cyberaqua' : 'de_silo');
  const mapsRow = foldRow('Maps for each stage', '', el('div', {}, [roundsBox, el('div', { class: 'gen-cycle-links' }, [browseArenasLink()])]));

  const serverRows = [];
  const tournamentRows = [];
  const only = (list, row) => {
    list.push(row);
    return row;
  };

  const passwordNote = el('span', { class: 'gen-switch-note', text: 'Redundant - the players are verified by their account ids.' });
  const passwordRow = revealRow('Join password', 'passwordOn', textInput('password', 'what players type to join'), 'Without it, anyone can join.');
  passwordRow.querySelector('.gen-row-ctl').appendChild(passwordNote);

  // one line across the table: what this tab makes
  const introRow = (text) => el('div', { class: 'gen-row gen-row-intro', text });

  const serverTable = el('div', { class: 'gen-table' }, [
    only(serverRows, introRow('A server that stays up for weeks and keeps itself updated.')),
    only(tournamentRows, introRow('Orchestrates the entire tournament from start to finish.')),
    only(serverRows, settingRow('Server name', [textInput('name', 'My server')])),
    only(serverRows, cycleRow),
    only(serverRows, settingRow('Slots', [sliderInput('slots', 4, 26)])),
    only(serverRows, settingRow('Server instances', [casualInput], 'Several servers, one after another.\n\nEach takes the next ports.')),
    only(serverRows, serverGameVarsRow),
    only(serverRows, botsRow),
    only(tournamentRows, settingRow('Tournament name', [textInput('tName', 'e.g. onFOSS November Cup 2026', 100)], 'Shown on the live results page.\n\nSent with the results to the webhook.\n\nThe same settings under the same name\ndon\'t start again.\nNext time, give it a new name.')),
    only(tournamentRows, settingRow('Teams', [teamSize])),
    only(tournamentRows, pairingRow),
    only(tournamentRows, playersRow),
    only(tournamentRows, joinTimeoutRow),
    only(tournamentRows, mapsRow),
    only(tournamentRows, tournamentGameVarsRow),
    only(tournamentRows, settingRow('Live results page', [switchInput('tPage', () => {}, '<code>http://&lt;your server&gt;:<span class="gen-page-port"></span>/</code>'), pageExampleButton], 'The bracket with live scores.\n\nServed by the game server itself, over TCP.\n\nAs JSON: `/tournament.json`.')),
    browserRow,
    portsRow,
    only(serverRows, serverWhoRow),
    passwordRow
  ]);

  // rarely needed - behind one button, open if anything in it is set
  const serverAdvanced = el('div', { class: 'gen-table gen-table-advanced' }, [
    only(serverRows, settingRow('Daily update', [switchInput('autoupdate', syncHour), hourSelect], "Players with a newer version\ncan't join an older server.\n\nEvery day at this hour (the machine's time),\nthe server restarts if a new version is out.")),
    only(serverRows, settingRow('Time zone', [timeZoneSelect()], 'Where the server is.\n\nBrowser players see\nhow far the server is.\n\nHappy hours (2x MMR) follow it.\n\nA VPS is often in UTC.')),
    serverListRow,
    adminRow,
    spectatorRow,
    only(tournamentRows, spectatorPlacesRow),
    only(tournamentRows, resultsWebhookRow),
    settingRow('Discord webhook', [textInput('webhook', 'to post joins and match results to your Discord')]),
    // its bot and its channel, both - a bot alone would post to the game's own channel (the default)
    settingRow('Telegram bot', [
      textInput('telegramToken', 'bot token, from @BotFather'),
      el('span', { class: 'gen-telegram-channel' }, [textInput('telegramChannel', 'e.g. @hypersomnia_monitor', 64)])
    ], 'Short notices only: who joins the server.\nMatch results go to Discord.\n\nRequires both: the bot\'s token and the channel\n(the bot an admin of it).')
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
    joinTimeoutRow.classList.toggle('open', !state.tJoinTimeoutOn && !state.adminOn);

    // the join password right under Who gets in, on either tab
    (isTournament() ? pairingRow : serverWhoRow).after(passwordRow);

    const serverListed = state.serverWho === 'accounts';
    serverWhoSelect.value = state.serverWho;
    serverWhoRow.classList.add('open');
    serverSecurityText.innerHTML = serverListed
      ? '<i class="fa-solid fa-check gen-secure"></i>Only your listed players - and your admins. <i class="fa-regular fa-circle-question gen-row-help" tabindex="0" data-tip="Every player proves who they are\nwith an `Ed25519` signature.\n\nNobody can join in their place."></i>'
      : 'Anyone who finds the server. A join password keeps strangers out.';
    [serverVerifyText, serverRoster, serverWhereText, serverIdImage, serverPublicText, serverNamesText].forEach(e => { e.hidden = !serverListed; });

    if (serverListed) {
      serverRoster.render();
    }
    pairingRow.classList.add('open');
    firstText.hidden = pairedBeforehand();

    // right under the list: what its nicknames are for
    nicknamesText.hidden = !pairedBeforehand();
    nicknamesText.innerHTML = verifiedByAccounts()
      ? 'Nicknames are only for your convenience:<br>participants may play under any other name.'
      : 'Players set these <strong>exact nicknames</strong> to be let in to the correct match.';
    // the same first line for all three - insecure with a warning, or secure with a check - so nothing below jumps
    insecureText.innerHTML = verifiedByAccounts()
      ? '<i class="fa-solid fa-check gen-secure"></i>Secure, also over the internet. <i class="fa-regular fa-circle-question gen-row-help" tabindex="0" data-tip="Every player proves who they are\nwith an `Ed25519` signature.\n\nNobody can join in their place."></i>'
      : '<i class="fa-solid fa-triangle-exclamation gen-insecure"></i>Insecure, but enough for a LAN.';

    const size = `${state.tTeamSize}v${state.tTeamSize}`;
    firstText.innerHTML = `Players join <strong>any ${size} server</strong> they want <em>in the first round</em>.<br>They can use <strong>any nicknames</strong> they like.<br>In later rounds, they will be paired automatically.`;

    verifyText.innerHTML = 'Every participant must send you their account id.<br>Paste them below:';
    verifyText.hidden = !verifiedByAccounts();
    [idsWhereText, tournamentIdImage, idsPublicText].forEach(e => { e.hidden = !verifiedByAccounts(); });
    idsText.hidden = !verifiedByAccounts();

    if (document.activeElement !== idsText) {
      if (verifiedByAccounts()) {
        syncIdLines();
      }

      idsText.value = state.tIdsText;
    }

    // off the list, browser players can't join - their port isn't opened either
    browserRow.classList.toggle('gen-row-disabled', !state.serverListOn);
    browserRow.querySelectorAll('input').forEach(i => { i.disabled = !state.serverListOn; });

    const verified = byAccounts();
    passwordRow.classList.toggle('gen-row-disabled', verified);
    passwordRow.querySelectorAll('input').forEach(i => { i.disabled = verified; });
    passwordNote.hidden = !verified;
    passwordRow.querySelector('.gen-row-ctl input[type=text]').hidden = verified || !state.passwordOn;

    const maps = roundMaps();
    mapsRow.show(maps.join(' <span class="gen-arrow">→</span> '), JSON.stringify(maps) === JSON.stringify(defaultRoundMaps()));

    // where the server's arenas are - its own maps go there
    cycleBox.allNote.innerHTML = 'See <a href="#" class="gen-goto-maps">Advanced: Add your own maps</a>';

    const orderTag = `<span class="gen-summary-tag">${state.cycleRandom ? 'random order' : 'in order'}</span>`;

    cycleRow.show(
      state.cycleAll ? 'All arenas on disk' + orderTag :
      state.cycle.length
        ? state.cycle.join(' <span class="gen-arrow">→</span> ') + (state.cycle.length > 1 ? `<span class="gen-summary-tag">${state.cycleRandom ? 'random order' : 'in order'}</span>` : '')
        : 'de_cyberaqua only',
      cycleIsDefault()
    );

    syncBotQuota();

    gameVarsRows.forEach(r => r.sync());

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
      `${portSpan(state.port)} UDP` + (browserOn() ? `, ${portSpan(state.webPort)} UDP` : '') + (pageOn() ? `, ${pagePort()} TCP` : ''),
      state.port === 8412 && state.webPort === 9000 && !state.tPagePort
    );

    tableWebPort.hidden = !browserOn();
    portWarning.hidden = state.port >= 8412 && state.port <= 8415;
    if (document.activeElement !== tablePagePort) {
      tablePagePort.value = String(pagePort());
    }

    tablePagePort.hidden = !pageOn();
    tablePageHead.style.display = pageOn() ? '' : 'none';
    // three columns with a tournament's results page, two without - each port under its own name
    tablePagePort.parentElement.classList.toggle('with-page', pageOn());
    document.querySelectorAll('.gen-page-port').forEach(e => { e.textContent = String(pagePort()); });
    tableWebHead.style.visibility = browserOn() ? '' : 'hidden';

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
    // printed for the players when not on the list
    playersKey: makeStep('For your players: the line to add your server', playersKeyResults, true),
    check: makeStep('Check that it works', checkBlock),
    // behind their own button, after the check: done later, if ever - the server key's backup and its move elsewhere
    mapsAdd: makeStep('Advanced: Add your own maps', mapsAddResults, true),
    keyBackup: makeStep('Advanced: Back up your server key', keyBackupResults, true),
    keySwap: makeStep('Advanced: Restore your server key', keySwapResults, true),
    keyPublic: makeStep('Advanced: Your server\'s public key', keyPublicResults, true)
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

  // the setup first - the rest needs what it makes (the user, the folders)
  [steps.before, steps.config, steps.secret, steps.service, steps.firewall, steps.start, steps.playersKey, steps.check].forEach(st => mount.appendChild(st.el));

  /*
    After the launch, if ever: steps always in sight, folded - their title opens them.
  */

  // "See Advanced: Add your own maps" in the map cycle: opens the step and goes to it
  document.addEventListener('click', e => {
    if (!e.target.closest('.gen-goto-maps')) {
      return;
    }

    e.preventDefault();

    if (!steps.mapsAdd.el.classList.contains('open')) {
      steps.mapsAdd.title.parentElement.click();
    }

    steps.mapsAdd.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  [steps.mapsAdd, steps.keyBackup, steps.keySwap, steps.keyPublic].forEach(st => {
    // left of the title: pointing at it while folded, down once opened
    const chevron = el('i', { class: 'fa-solid fa-chevron-right gen-fold-chevron' });
    st.el.classList.add('gen-foldable');
    st.title.parentElement.prepend(chevron);

    st.title.parentElement.addEventListener('click', () => {
      const open = st.el.classList.toggle('open');
      chevron.className = `fa-solid fa-chevron-${open ? 'down' : 'right'} gen-fold-chevron`;
    });

    mount.appendChild(st.el);
  });

  /*
    Step by step, or all of it in one script - the same commands and files either way.
  */


  const modeButton = (label, icon, value) => {
    const b = el('button', { type: 'button', html: `<i class="${icon}"></i>${label}` });
    b.addEventListener('click', () => { oneShot = value; update(); });
    return el('div', { class: 'btn' }, [b]);
  };

  const stepsTab = modeButton('Step by step', 'fa-solid fa-list-ol', false);
  const scriptTab = modeButton('Single script', 'fa-solid fa-scroll', true);
  const modeTabs = el('div', { class: 'btn-group gen-mode-tabs' }, [scriptTab, stepsTab]);

  const scriptCode = el('code');
  const firewallSelect = el('select', {}, [
    el('option', { value: 'none', text: 'Leave it as it is' }),
    el('option', { value: 'ufw', text: 'ufw (Ubuntu, Debian)' }),
    el('option', { value: 'firewalld', text: 'firewalld (Fedora, RHEL)' })
  ]);

  firewallSelect.value = state.firewall;
  firewallSelect.addEventListener('change', () => { state.firewall = firewallSelect.value; update(); });
  refreshers.push(() => { firewallSelect.value = state.firewall; });

  const scriptStartCheck = el('input', { type: 'checkbox' });
  scriptStartCheck.checked = scriptOptions.start;
  scriptStartCheck.addEventListener('change', () => { scriptOptions.start = scriptStartCheck.checked; update(); });
  const scriptStartOption = optionSwitch(scriptStartCheck, 'Start it now', '');
  const scriptStartNote = scriptStartOption.querySelector('.gen-switch-note');

  const dataFolderCheck = el('input', { type: 'checkbox' });
  dataFolderCheck.checked = scriptOptions.dataFolder;
  dataFolderCheck.addEventListener('change', () => { scriptOptions.dataFolder = dataFolderCheck.checked; update(); });
  const dataFolderOption = optionSwitch(dataFolderCheck, 'Make the data folder', '/opt/hypersomnia, for the container\'s user');

  const scriptOptionsBox = el('div', { class: 'gen-script-options' }, [
    selectRow('Firewall', firewallSelect),
    scriptStartOption
  ]);


  const scriptBlock = el('div', { class: 'gen-before-box' }, [
    scriptOptionsBox,
    el('div', { class: 'guide-code gen-start-code' }, [
      el('button', { type: 'button', class: 'guide-copy', title: 'Copy', html: '<i class="fa-regular fa-copy"></i>' }),
      el('pre', {}, [scriptCode])
    ]),
  ]);

  steps.script = makeStep('Your script', scriptBlock, true);
  // above the first step - the setup's commands
  mount.insertBefore(modeTabs, steps.before.el);
  mount.insertBefore(steps.script.el, steps.check.el);

  /*
    The setup's switches (as a service, as its own user) and the FUSE field belong to both views - moved into the one shown.
  */

  function updateScript() {
    // update() runs once before the views are made
    if (!steps.script) {
      return;
    }

    stepsTab.firstChild.classList.toggle('active', !oneShot);
    scriptTab.firstChild.classList.toggle('active', oneShot);

    [steps.config, steps.secret, steps.before, steps.service, steps.firewall, steps.start, steps.playersKey].forEach(st => st.el.classList.toggle('gen-mode-off', oneShot));
    steps.script.el.hidden = !oneShot;

    if (oneShot) {
      scriptOptionsBox.append(serviceOption, fuseField, dataFolderOption, scriptStartOption);
      fuseField.hidden = !(method() === 'terminal' || method() === 'service');
    }
    else if (serviceOption.parentElement !== beforeBlock) {
      beforeBlock.prepend(serviceOption);
    }

    dataFolderOption.hidden = !(method() === 'compose' || method() === 'run');
    scriptStartNote.textContent = method() === 'service' ? 'otherwise at the next reboot' : 'otherwise the startup command stays commented out';
    scriptCode.textContent = oneShotScript();
    highlight(scriptCode, 'bash');

    if (reservesFuseLine()) {
      scriptCode.appendChild(reservedLine());
    }

  }


  // as the game's is_valid_account_id: the prefixes in lowercase, the hex in either case, no = , ; in a crazygames id
  const ACCOUNT_ID = /^(steam_\d{17}|0x[0-9a-fA-F]{64}|key_[0-9a-fA-F]{64}|[0-9a-fA-F]{64}|crazygames_[^\s=,;]+)$/;

  // 0x<key>, key_<key> and the bare key are one account - as the game's normalize_account_id
  const sameAccount = id => /^(0x|key_)?[0-9a-f]{64}$/i.test(id) ? 'key_' + id.toLowerCase().replace(/^(0x|key_)/, '') : id;

  const spectatorId = () => state.spectatorOn ? state.spectator.trim() : '';
  const resultsWebhook = () => isTournament() ? state.tResultsWebhook.trim() : '';

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
  */

  const shellQuote = v => /^[A-Za-z0-9_.,:\/=+-]+$/.test(v) ? v : "'" + v.replace(/'/g, "'\\''") + "'";

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
      // the teams in one argument - from the variable above the command (teamsVariable)
      out.push('--tournament-teams "$TEAMS"');
    }
    else {
      out.push(`--tournament ${state.tPlayers}`);

      if (state.tTeamSize > 1) {
        out.push(`--tournament-team-size ${state.tTeamSize}`);
      }
    }

    if (isTournament()) {
      // from the variable above the command (arenasVariable)
      out.push('--tournament-arenas "$ARENAS"');
    }

    if (isTournament() && state.tName.trim()) {
      out.push(`--tournament-name ${quoted(state.tName.trim())}`);
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

    if (state.tSpectatorPlaces !== 6) {
      out.push(`--tournament-spectators ${state.tSpectatorPlaces}`);
    }

    return out;
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
  // only map_cycle: the server starts on its first (or a random one of it); one map alone stays
  // the game's own default: the three arenas, shuffled - no line for it
  const cycleOn = () => !isTournament() && !cycleIsDefault();
  const cycleArenas = () => state.cycleAll ? ['*'] : (state.cycle.length ? state.cycle : ['de_cyberaqua']).map(withMode);
  const cycleShuffleOff = () => !state.cycleRandom && (state.cycleAll || state.cycle.length > 1);

  function buildSettings() {
    const ids = adminIds();

    const server = {};
    const config = {};

    if (!isTournament()) {
      // "My server" is the game's own default - no config for it
      if (state.name.trim() && state.name.trim() !== 'My server') {
        server.server_name = state.name.trim();
      }
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

    // the game vars - only what differs from the game's own defaults
    if (state.ownGameSpeed) {
      server.game_speed = state.gameSpeed;
    }

    if (state.ownBulletSpeed) {
      server.bullet_speed = state.bulletSpeed;
    }

    if (state.ownZoom) {
      server.zoom_override = state.zoom;
    }

    if (state.friendlyFire) {
      server.friendly_fire = true;
    }

    if (!state.freezeTime) {
      server.freeze_time = false;
    }

    // server_private goes into its own file - the config can be shown to anyone
    const secrets = {};

    if (ids.length) {
      secrets.admin_profiles = ids.map(account => ({ account, rcon: 'MASTER_RCON' }));
    }

    if (spectatorId()) {
      secrets.spectator_account = spectatorId();
    }

    if (resultsWebhook()) {
      secrets.tournament_results_webhook_url = resultsWebhook();
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
      server.map_cycle = cycleArenas();

      if (cycleShuffleOff()) {
        server.map_cycle_random = false;
      }
    }

    if (serverListChanged()) {
      server.notified_server_list = serverListAddress();
    }

    if (!browserOn()) {
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

    if (telegramOn()) {
      secrets.telegram_webhook_url = `https://api.telegram.org/bot${state.telegramToken.trim()}`;
      secrets.telegram_channel_id = state.telegramChannel.trim();
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

  const SECRET_VARS = ['HYPERSOMNIA_PASSWORD', 'HYPERSOMNIA_DISCORD_WEBHOOK', 'HYPERSOMNIA_TOURNAMENT_RESULTS_WEBHOOK', 'HYPERSOMNIA_TELEGRAM_BOT_TOKEN'];

  // the bot and its channel, both filled - one alone is an error (configErrors)
  const telegramOn = () => state.telegramToken.trim() !== '' && state.telegramChannel.trim() !== '';

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

  /*
    Every docker command with sudo: the docker socket is root's - only root and the docker group may use it,
    and the scripts use sudo already (the data folder).
  */

  /*
    docker run's secrets: in a file next to it (--env-file), not on its command line - where ps shows them.
    Docker reads its values as they are, no quotes - a secret is one line (sanitizeState).
  */

  const RUN_ENV_FILE = 'hypersomnia.env';

  function runEnvFile() {
    const secret = dockerEnv().filter(([k]) => SECRET_VARS.includes(k));
    return secret.map(([k, v]) => `${k}=${v}`).join('\n');
  }

  function dockerEnv() {
    const named = !isTournament() && state.name.trim() && state.name.trim() !== 'My server';
    const env = named ? [['HYPERSOMNIA_SERVER_NAME', state.name.trim()]] : [];
    const ids = adminIds();
    const put = (k, v) => env.push([k, v]);

    if (cycleOn()) {
      put('HYPERSOMNIA_MAP_CYCLE', cycleArenas().join(','));

      if (cycleShuffleOff()) {
        put('HYPERSOMNIA_MAP_CYCLE_RANDOM', 'off');
      }
    }

    if (ids.length) {
      put('HYPERSOMNIA_ADMINS', ids.join(','));
    }

    if (spectatorId()) {
      put('HYPERSOMNIA_SPECTATOR', spectatorId());
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

    // the game vars (environment_variables.cpp) - only what differs from the defaults
    if (state.ownGameSpeed) {
      put('HYPERSOMNIA_GAME_SPEED', String(state.gameSpeed));
    }

    if (state.ownBulletSpeed) {
      put('HYPERSOMNIA_BULLET_SPEED', String(state.bulletSpeed));
    }

    if (state.ownZoom) {
      put('HYPERSOMNIA_ZOOM', String(state.zoom));
    }

    if (state.friendlyFire) {
      put('HYPERSOMNIA_FRIENDLY_FIRE', 'on');
    }

    if (!state.freezeTime) {
      put('HYPERSOMNIA_FREEZE_TIME', 'off');
    }

    if (!isTournament() && state.casual !== 1) {
      put('HYPERSOMNIA_SERVER_INSTANCES', String(state.casual));
    }

    if (state.port !== 8412) {
      put('HYPERSOMNIA_PORT', String(state.port));
    }

    if (serverListChanged()) {
      put('HYPERSOMNIA_SERVER_LIST', serverListAddress() || 'off');
    }

    if (!browserOn()) {
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

    if (telegramOn()) {
      put('HYPERSOMNIA_TELEGRAM_BOT_TOKEN', state.telegramToken.trim());
      put('HYPERSOMNIA_TELEGRAM_CHANNEL', state.telegramChannel.trim());
    }

    if (state.webhook) {
      put('HYPERSOMNIA_DISCORD_WEBHOOK', state.webhook);
    }

    if (pairedBeforehand()) {
      // a player per line, the teams apart by an empty line
      put('HYPERSOMNIA_TOURNAMENT_TEAMS', teamsText());
      put('HYPERSOMNIA_TOURNAMENT_ARENAS', arenasText());
    }
    else if (isTournament()) {
      put('HYPERSOMNIA_TOURNAMENT', String(state.tPlayers));

      if (state.tTeamSize > 1) {
        put('HYPERSOMNIA_TOURNAMENT_TEAM_SIZE', String(state.tTeamSize));
      }

      put('HYPERSOMNIA_TOURNAMENT_ARENAS', arenasText());
    }

    if (isTournament() && state.tName.trim()) {
      put('HYPERSOMNIA_TOURNAMENT_NAME', state.tName.trim());
    }

    if (resultsWebhook()) {
      put('HYPERSOMNIA_TOURNAMENT_RESULTS_WEBHOOK', resultsWebhook());
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

    if (isTournament() && state.tSpectatorPlaces !== 6) {
      put('HYPERSOMNIA_TOURNAMENT_SPECTATORS', String(state.tSpectatorPlaces));
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
      browserOn() ? `      - '${web}:${web}/udp'` : null,
      '    environment:'
    ].filter(line => line !== null);

    env.forEach(([k, v]) => {
      if (SECRET_VARS.includes(k)) {
        lines.push(`      ${k}: \${${k}}`);
      }
      // compose expands $NAME in compose.yaml: $$ is a $
      else if (v.includes('\n')) {
        lines.push(`      ${k}: |`);
        // an empty line (between the teams) without spaces
        v.split('\n').forEach(l => lines.push(l ? '        ' + l.replace(/\$/g, '$$$$') : ''));
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
      'sudo docker run -d --name hypersomnia-server',
      '  --restart unless-stopped',
      `  --publish ${game}:${game}/udp`,
      pageOn() ? `  --publish ${pagePort()}:${pagePort()}/tcp` : null,
      browserOn() ? `  --publish ${web}:${web}/udp` : null,
      '  --volume /opt/hypersomnia:/home/hypersomniac/.config/Hypersomnia/user'
    ].filter(line => line !== null);

    // the teams from the variable above the command (teamsVariable)
    const fromVariable = { HYPERSOMNIA_TOURNAMENT_TEAMS: '"$TEAMS"', HYPERSOMNIA_TOURNAMENT_ARENAS: '"$ARENAS"' };
    env.filter(([k]) => !SECRET_VARS.includes(k)).forEach(([k, v]) => lines.push(`  --env ${k}=${fromVariable[k] || quote(v)}`));

    if (runEnvFile()) {
      lines.push(`  --env-file ${RUN_ENV_FILE}`);
    }

    lines.push('  ghcr.io/teamhypersomnia/hypersomnia-server:latest');
    return startVariables() + lines.map((l, i) => i < lines.length - 1 ? l + ' \\' : l).join('\n');
  }

  // a tournament never restarts in the middle of it to update
  const updatesOn = () => state.autoupdate && !isTournament();

  const extractFlag = () => state.fuse ? '' : ' --appimage-extract-and-run';

  function startCommand() {
    // a persistent server in a terminal updates itself by the flag, as the service does
    const flags = [
      state.fuse ? null : '--appimage-extract-and-run',
      currentSetup === 'server-appimage' && updatesOn() ? '--daily-autoupdate' : null,
      ...(isTournament() ? tournamentFlags() : [])
    ].filter(Boolean);

    // the executable on its own line, then a flag per line - as docker run's
    const command = ['./Hypersomnia-Headless.AppImage', ...flags.map(f => '  ' + f)].map((l, i, all) => i < all.length - 1 ? l + ' \\' : l).join('\n');

    return startVariables() + command;
  }

  /*
    The service: as yourself, a systemd user service next to the AppImage in your home folder (%h) - no paths, no sudo;
    or as a separate user, a system service in /opt/hypersomnia.
  */

  const ownUser = () => state.service !== 'user';

  function serviceUnit() {
    const flags = [
      '--as-service',
      updatesOn() ? '--daily-autoupdate' : '',
      ownUser() ? '' : '--appdata-dir /opt/hypersomnia'
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

  function firewallLines(kind) {
    const ufw = s => s.replace('-', ':');
    const web = browserOn();

    const lines = kind === 'ufw' ? [
      '# ufw (Ubuntu, Debian)',
      `sudo ufw allow ${ufw(portSpan(state.port))}/udp`,
      web ? `sudo ufw allow ${ufw(portSpan(state.webPort))}/udp` : null,
      pageOn() ? `sudo ufw allow ${pagePort()}/tcp` : null
    ] : [
      '# firewalld (Fedora, RHEL)',
      `sudo firewall-cmd --permanent --add-port=${portSpan(state.port)}/udp`,
      web ? `sudo firewall-cmd --permanent --add-port=${portSpan(state.webPort)}/udp` : null,
      pageOn() ? `sudo firewall-cmd --permanent --add-port=${pagePort()}/tcp` : null,
      'sudo firewall-cmd --reload'
    ];

    return lines.filter(line => line !== null);
  }

  // what the firewall opens, in words
  function openedPorts() {
    return [
      `UDP ${portSpan(state.port)}`,
      browserOn() ? `UDP ${portSpan(state.webPort)}` : null,
      pageOn() ? `TCP ${pagePort()}` : null
    ].filter(Boolean).join(', ');
  }

  function firewall() {
    return [...firewallLines('ufw'), '', ...firewallLines('firewalld')].join('\n');
  }

  /*
    The one-shot script: the same steps as above in one paste - safe to run again (the files are written anew).
    The files by heredocs, with a quoted end mark - nothing in them is expanded. Its own lines wrapped for a terminal,
    between the arguments only (a quoted one stays whole), continued with a backslash.
  */

  const SCRIPT_WIDTH = 78;

  // every line of a command wrapped so (wrapCommand)
  const wrapped = text => text.split('\n').map(wrapCommand).flat().join('\n');

  /*
    A command's arguments as the shell splits them: at spaces outside quotes, a backslash keeping the next character.
    Null when a quote isn't closed.
  */

  function shellWords(text) {
    const words = [];
    let current = '';
    let quote = '';

    for (let i = 0; i < text.length; ++i) {
      const c = text[i];

      if (quote) {
        current += c;

        if (c === '\\' && quote === '"' && i + 1 < text.length) {
          current += text[++i];
        }
        else if (c === quote) {
          quote = '';
        }
      }
      else if (c === '\\' && i + 1 < text.length) {
        current += c + text[++i];
      }
      else if (c === "'" || c === '"') {
        quote = c;
        current += c;
      }
      else if (c === ' ' || c === '\t') {
        if (current) {
          words.push(current);
          current = '';
        }
      }
      else {
        current += c;
      }
    }

    if (quote) {
      return null;
    }

    if (current) {
      words.push(current);
    }

    return words;
  }

  function wrapCommand(line) {
    const continued = / \\$/.test(line);
    const body = continued ? line.slice(0, -2) : line;
    const indent = body.match(/^ */)[0];

    if (body.length <= SCRIPT_WIDTH) {
      return [line];
    }

    // the arguments, a quoted one whole (an apostrophe written as '\'' too) - not sure where they end: not wrapped
    const words = shellWords(body.trim());

    if (words === null) {
      return [line];
    }

    const out = [];
    let current = indent;

    words.forEach(w => {
      const fresh = current.trim() === '';

      if (!fresh && (current + ' ' + w).length > SCRIPT_WIDTH - 2) {
        out.push(current + ' \\');
        current = indent + '  ' + w;
      }
      else {
        current = fresh ? indent + w : current + ' ' + w;
      }
    });

    out.push(continued ? current + ' \\' : current);
    return out;
  }

  function scriptWhere() {
    return {
      terminal: [
        'On the server, in the folder for the game - the AppImage lands here.',
        'It runs in this terminal. Again? Stop it first (Ctrl+C).'
      ],
      service: ownUser()
        ? ['On the server, as the user to run it (not root) - the AppImage', 'lands in your home folder.']
        : ['On the server, as a user with sudo - everything goes to', '/opt/hypersomnia, the server runs as the user hypersomnia.'],
      compose: ['On the server with Docker, in the folder for compose.yaml.'],
      run: ['On the server with Docker - its data goes to /opt/hypersomnia.']
    }[method()];
  }

  /*
    The server key of this setup: where the server keeps it (KEYS_DIR: the user folder's .keys), how a file is put there
    (only the server's user may read it), how it's backed up from your computer, and how its public half is printed.
  */

  // the arenas the server has on its disk - the official ones are in the AppImage, these next to them
  function arenasDir() {
    const m = method();

    if (m === 'compose' || m === 'run') {
      return '/opt/hypersomnia/downloads/arenas';
    }

    return separateUser() ? '/opt/hypersomnia/user/downloads/arenas' : '~/.config/Hypersomnia/user/downloads/arenas';
  }

  /*
    A map of your own onto the server, from your computer: its folder (<map>/<map>.json and the rest) into arenasDir().
    The server's own user or the container's owns the folder - copied through /tmp, then moved in with sudo.
    Named by the cycle's first map not on hypersomnia.io, if there is one.
  */

  function ownMapName() {
    const known = new Set(arenas.official.concat(arenas.community));
    return state.cycle.find(name => !known.has(name)) || 'de_mymap';
  }

  function addMapsCommand() {
    const m = method();
    const dir = arenasDir();
    const map = ownMapName();

    // the map's name once, at the top - in double quotes below, filled in on your computer
    const name = `MAP=${map}\n\n`;

    if (dir.startsWith('~/')) {
      const remote = dir.slice(2);
      return `${name}ssh <your server> 'mkdir -p ${remote}'\nscp -r "$MAP" <your server>:${remote}/`;
    }

    const owner = m === 'compose' || m === 'run' ? '999:999' : 'hypersomnia:';
    // copied over an older copy of it (cp merges), the one in /tmp removed after
    return `${name}scp -r "$MAP" <your server>:/tmp/\nssh <your server> "\n  sudo mkdir -p ${dir} &&\n  sudo cp -r /tmp/$MAP ${dir}/ &&\n  sudo chown -R ${owner} ${dir} &&\n  rm -r /tmp/$MAP"`;
  }

  function keyPath() {
    const m = method();

    if (m === 'compose' || m === 'run') {
      return '/opt/hypersomnia/.keys/server.key';
    }

    return separateUser() ? '/opt/hypersomnia/user/.keys/server.key' : '~/.config/Hypersomnia/user/.keys/server.key';
  }

  /*
    A key from another machine, after the launch: the server reads it only when it starts - stopped, the file put in place
    (only the server's user may read it), started again. Run where the file is.
  */

  function keySwap() {
    const m = method();
    const path = keyPath();
    const folder = path.replace(/\/server\.key$/, '');
    const file = 'hypersomnia-server.key';

    if (m === 'compose' || m === 'run') {
      const [stop, start] = m === 'compose'
        ? ['sudo docker compose stop', 'sudo docker compose start']
        : ['sudo docker stop hypersomnia-server', 'sudo docker start hypersomnia-server'];

      return `${stop}\nsudo mkdir -p ${folder}\n# 999: the server's user inside the container\nsudo install -m 600 -o 999 -g 999 ${file} ${path}\nsudo chown 999:999 ${folder}\nsudo chmod 700 ${folder}\n${start}`;
    }

    if (separateUser()) {
      return `sudo systemctl stop hypersomnia\nsudo -u hypersomnia mkdir -p ${folder}\nsudo chmod 700 ${folder}\nsudo install -m 600 -o hypersomnia -g hypersomnia ${file} ${path}\nsudo systemctl start hypersomnia`;
    }

    const install = `mkdir -p ${folder}\nchmod 700 ${folder}\ninstall -m 600 ${file} ${path}`;

    if (m === 'service') {
      return `systemctl --user stop hypersomnia\n${install}\nsystemctl --user start hypersomnia`;
    }

    return `# stop the server first (Ctrl+C), then:\n${install}\n# and start it again - Your startup command`;
  }

  /*
    Only you may read the copy too (600): scp keeps the file's own; read with sudo, the copy is made under umask 077.
  */

  function keyBackupCommand() {
    const path = keyPath();

    if (path.startsWith('~/')) {
      return `scp <your server>:${path.slice(2)} hypersomnia-server.key`;
    }

    // into a .new first: a failed copy never leaves an empty file that looks like the backup
    return `(umask 077 && ssh <your server> 'sudo cat ${path}' > hypersomnia-server.key.new && mv hypersomnia-server.key.new hypersomnia-server.key)`;
  }

  function printKeyCommand() {
    const m = method();
    const extract = state.fuse ? '' : ' --appimage-extract-and-run';

    if (m === 'compose' || m === 'run') {
      return 'sudo docker run --rm \\\n  --volume /opt/hypersomnia:/home/hypersomniac/.config/Hypersomnia/user \\\n  ghcr.io/teamhypersomnia/hypersomnia-server:latest \\\n  ./Hypersomnia-Headless.AppImage --appimage-extract-and-run --print-server-key';
    }

    if (separateUser()) {
      return `sudo -u hypersomnia /opt/hypersomnia/Hypersomnia-Headless.AppImage${extract} \\\n  --appdata-dir /opt/hypersomnia --print-server-key`;
    }

    return `${m === 'service' ? '~' : '.'}/Hypersomnia-Headless.AppImage${extract} --print-server-key`;
  }

  /*
    The line for the players (--print-join-string): the address the server list sees, the name and the port of the
    config, the key. With Docker in the running container - its own environment, so its name and port.
  */

  function printJoinCommand() {
    const m = method();
    const extract = state.fuse ? '' : ' --appimage-extract-and-run';

    if (m === 'compose') {
      return 'sudo docker compose exec hypersomnia-server \\\n  ./Hypersomnia-Headless.AppImage --appimage-extract-and-run --print-join-string';
    }

    if (m === 'run') {
      return 'sudo docker exec hypersomnia-server \\\n  ./Hypersomnia-Headless.AppImage --appimage-extract-and-run --print-join-string';
    }

    if (separateUser()) {
      return `sudo -u hypersomnia /opt/hypersomnia/Hypersomnia-Headless.AppImage${extract} \\\n  --appdata-dir /opt/hypersomnia --print-join-string`;
    }

    return `${m === 'service' ? '~' : '.'}/Hypersomnia-Headless.AppImage${extract} --print-join-string`;
  }

  function oneShotScript() {
    const m = method();
    const docker = m === 'compose' || m === 'run';
    const asUser = separateUser();
    const lines = [];
    const raw = text => text.split('\n').forEach(l => lines.push(l));
    const cmd = text => text.split('\n').forEach(l => wrapCommand(l).forEach(w => lines.push(w)));
    const section = title => lines.push('', `# ${title}`);

    // a file: as the server's own user, as root, or as whoever runs the script - a secret one made readable by its owner only
    const write = (path, text, owner, secret = false) => {
      const into =
        owner === 'user' ? `sudo -u hypersomnia tee ${path} > /dev/null` :
        owner === 'root' ? `sudo tee ${path} > /dev/null` :
        `cat > ${path}`
      ;

      cmd(secret ? `(umask 077 && ${into}) <<'EOF'` : `${into} <<'EOF'`);
      raw(text);
      lines.push('EOF');
    };

    const starts = scriptOptions.start;
    const firewallText = state.firewall === 'none'
      ? 'left as it is'
      : `${state.firewall} - opens ${openedPorts()}`;
    const setupLine = m === 'service' ? (ownUser() ? 'a systemd service, as you' : 'a systemd service, as the user hypersomnia') : setupName();
    const again = {
      terminal: 'the files written anew',
      service: 'the files written anew, the service restarted',
      compose: 'the files written anew, the container recreated if changed',
      run: 'the container replaced'
    }[m];

    lines.push(
      '#!/bin/bash',
      '#',
      `# Hypersomnia - ${setupName() || 'server'}`,
      '# Made at hypersomnia.io/generator',
      '#',
      '# Where to run it:',
      ...scriptWhere().map(l => `#   ${l}`),
      '#',
      `# Safe to run again: ${again}.`,
      '#',
      `# Setup:     ${setupLine}`,
      docker ? `# Data:      /opt/hypersomnia${scriptOptions.dataFolder ? ', made here' : ' - there already'}` : null,
      `# Firewall:  ${firewallText}`,
      `# Start now: ${starts ? 'yes' : m === 'service' ? 'no - it starts at the next reboot' : 'no - the startup command stays commented out'}`,
      '#',
      '# Pasted into a terminal: all in ( ) - a failed step ends the script, not your session,',
      '# and the space before ( keeps it, passwords too, out of the history where the shell skips such lines (Debian, Ubuntu).',
      ' (',
      'set -euo pipefail'
    );

    // the data folder's line only with Docker
    for (let i = lines.length - 1; i >= 0; --i) {
      if (lines[i] === null) {
        lines.splice(i, 1);
      }
    }

    const before = docker && !scriptOptions.dataFolder ? '' : beforeText();

    if (before) {
      section(m === 'compose' || m === 'run' ? 'The server\'s data folder' : 'The game');

      // the user is made only once
      before.split('\n').forEach(l => cmd(l.startsWith('sudo useradd') ? `id hypersomnia > /dev/null 2>&1 || ${l}` : l));
    }

    if (m === 'compose') {
      section('compose.yaml and its .env - in this folder');
      write('compose.yaml', compose());

      // run again without secrets: the old ones would stay in force
      if (dotEnv()) {
        write('.env', dotEnv(), '', true);
        cmd('chmod 600 .env');
      }
      else {
        cmd('rm -f .env');
      }
    }
    else if (m === 'run') {
      section(`The secrets - ${RUN_ENV_FILE}, in this folder`);

      if (runEnvFile()) {
        write(RUN_ENV_FILE, runEnvFile(), '', true);
        cmd(`chmod 600 ${RUN_ENV_FILE}`);
      }
      else {
        cmd(`rm -f ${RUN_ENV_FILE}`);
      }
    }
    else if (m === 'terminal' || m === 'service') {
      const { json, secrets } = buildSettings();

      // run again with fewer settings: a file not needed now is removed - the old one would stay in force
      section('The config');
      const remove = path => cmd(asUser ? `sudo -u hypersomnia rm -f ${path}` : `rm -f ${path}`);

      if (json) {
        write(configPath(), prettyJson(json), asUser ? 'user' : '');
      }
      else {
        remove(configPath());
      }

      if (secrets) {
        write(privatePath(), prettyJson(secrets), asUser ? 'user' : '', true);
        cmd(privateChmod());
      }
      else {
        remove(privatePath());
      }

      if (m === 'service') {
        section('The service');
        write(ownUser() ? '~/.config/systemd/user/hypersomnia.service' : '/etc/systemd/system/hypersomnia.service', serviceUnit(), ownUser() ? '' : 'root');
      }
    }

    if (state.firewall !== 'none') {
      section('The firewall');
      const tool = state.firewall === 'ufw' ? 'ufw' : 'firewall-cmd';
      // looked for as root: /usr/sbin isn't in a user's PATH on Debian
      cmd(`if ! sudo sh -c 'command -v ${tool}' > /dev/null; then\n  echo "No ${tool} here - pick your firewall in the generator."\n  exit 1\nfi`);
      cmd(firewallLines(state.firewall).slice(1).join('\n'));
    }

    /*
      Not on the list: the players' line - before a terminal's start (it runs on in the foreground); a container's
      only once it runs (printed from inside it, with its own environment).
    */

    const playersLine = () => {
      if (isTournament()) {
        section('Not on the server list: give your players its address and this key');
        cmd(printKeyCommand());
      }
      else {
        section('Not on the server list: the line to publish for your players');
        cmd(printJoinCommand());
      }
    };

    if (!state.serverListOn && !docker) {
      playersLine();
    }

    if (starts) {
      section('Start it');

      if (m === 'run') {
        cmd('sudo docker rm -f hypersomnia-server > /dev/null 2>&1 || true');
        lines.push('');
      }

      cmd(startText());
    }
    else if (m === 'service') {
      section('Start with the machine - not now');
      cmd(startText().split('\n').filter(l => !/ restart /.test(l)).join('\n'));
      lines.push('', '# To start it now:');
      startText().split('\n').filter(l => / restart /.test(l)).forEach(l => lines.push(`# ${l}`));
    }
    else {
      // everything's set up - the start left for later, commented out
      section('The startup command - uncomment to start it:');
      const later = (m === 'run' ? 'sudo docker rm -f hypersomnia-server > /dev/null 2>&1 || true\n\n' : '') + startText();
      later.split('\n').forEach(l => wrapCommand(l).forEach(w => lines.push(`# ${w}`)));
    }

    // a container's line once it runs - not started now, the command for later
    if (!state.serverListOn && docker) {
      if (starts) {
        playersLine();
      }
      else {
        section('Not on the server list - once it runs, the line for your players:');
        printJoinCommand().split('\n').forEach(l => lines.push(`# ${l}`));
      }
    }

    lines.push(')');
    return lines.join('\n');
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

    if (state.serverListOn && !/^[A-Za-z0-9.-]+:\d{1,5}$/.test(state.serverList.trim())) {
      errors.push(`Server list: an address with its port, e.g. ${DEFAULT_SERVER_LIST}`);
    }
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

    if (state.spectatorOn && !state.spectator.trim()) {
      errors.push('Spectator: paste its account id - or switch it off.');
    }
    else if (spectatorId() && !ACCOUNT_ID.test(spectatorId())) {
      errors.push(`Spectator: not an account id: ${spectatorId()}`);
    }

    if (resultsWebhook() && !/^https?:\/\/\S+$/.test(resultsWebhook())) {
      errors.push('Results webhook: a link starting with https://');
    }

    if (state.passwordOn && !verifiedByAccounts() && !state.password.trim()) {
      errors.push('Join password: type it - or switch it off.');
    }

    // the game counts the name's bytes - at most 100
    if (isTournament() && new TextEncoder().encode(state.tName.trim()).length > 100) {
      errors.push('Tournament name: at most 100 characters (fewer with letters like ą or ł).');
    }

    const token = state.telegramToken.trim();
    const channel = state.telegramChannel.trim();

    if ((token === '') !== (channel === '')) {
      errors.push('Telegram: both the bot token and the channel');
    }
    else if (token && !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      errors.push('Telegram: a bot token looks like 123456789:AAH...');
    }
    else if (channel && !/^(@[A-Za-z0-9_]{5,32}|-?\d+)$/.test(channel)) {
      errors.push('Telegram: the channel as @name or its number');
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

    if (browserOn() && state.port < state.webPort + n && state.webPort < state.port + n) {
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

    const bad = adminIds().filter(id => !ACCOUNT_ID.test(id));
    adminWarning.textContent = bad.length
      ? `Not an account id: ${bad.join(', ')} - copy it from Settings → Account in the game (steam_ + 17 digits, or 0x + 64 characters).`
      : '';
    adminWarning.style.color = bad.length ? 'var(--red)' : '';
    adminWarning.style.display = bad.length ? '' : 'none';

    updatePairing();
    updateCheck();
    updateSpectatorPlaces();
    updateServerList();
    rebuildRounds();
    updateTable();

    const n = instanceCount();
    const ports = browserOn() ? `UDP ${portSpan(state.port)} and ${portSpan(state.webPort)}` : `UDP ${portSpan(state.port)}`;

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
        // the command is the start - in Your startup command; its secrets in a file next to it
        if (runEnvFile()) {
          secretResults.appendChild(resultBox({
            file: RUN_ENV_FILE,
            lang: 'bash',
            text: runEnvFile(),
            hint: `In the folder you run docker run from. Restrict who can read the file: ${inline(`chmod 600 ${RUN_ENV_FILE}`)}`
          }));
        }
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
          hint: '',
          unneeded: !json
        }));
      }
    });

    keyBackupResults.innerHTML = '';
    keyBackupResults.append(
      el('p', { class: 'gen-field-text', text: 'Run this from your computer:' }),
      resultBox({
        lang: 'bash',
        text: wrapped(keyBackupCommand()),
        hint: (keyPath().startsWith('~/') ? '' : 'Needs root, or sudo without a password, on the server.<br>')
          + 'Players bookmark your server by its key: <code>Ed25519</code>.<br>Without it, you appear as a different server.<br>Keep it secret - with it, anyone can pose as your server.'
      })
    );

    keyPublicResults.innerHTML = '';
    keyPublicResults.appendChild(resultBox({
      lang: 'bash',
      text: wrapped(printKeyCommand()),
      hint: 'On the server.<br>Public - safe to share.<br>Send it to us on <a href="https://discord.gg/YC49E4G" target="_blank">Discord<i class="fa-solid fa-arrow-up-right-from-square gen-ext"></i></a> to make your tournament official -<br>its matches then count towards MMR.'
    }));
    // a tournament's only: a persistent server's players don't need it
    steps.keyPublic.el.hidden = !isTournament();

    mapsAddResults.innerHTML = '';
    mapsAddResults.append(
      el('p', { class: 'gen-field-text', html: `By default, only the official maps are on the disk - the others you provide yourself.<br>The server's maps folder: ${inline(arenasDir() + '/')}<br><br>Run this from your computer, in the folder that holds the map's folder:` }),
      resultBox({
        lang: 'bash',
        text: wrapped(addMapsCommand()),
        hint: 'The server reads its maps when it starts - restart it.<br>Maps on <a href="/arenas" target="_blank">hypersomnia.io<i class="fa-solid fa-arrow-up-right-from-square gen-ext"></i></a> need none of this: the server downloads them itself.'
      })
    );

    keySwapResults.innerHTML = '';
    keySwapResults.appendChild(resultBox({
      lang: 'bash',
      text: wrapped(keySwap()),
      hint: method() === 'compose'
        ? 'On the new machine, in the folder of <code>compose.yaml</code>, with <code>hypersomnia-server.key</code> put there.'
        : 'On the new machine, in the folder with <code>hypersomnia-server.key</code>.'
    }));

    /*
      Not on the server list: players add it by hand - "<address>,<name>,0x<key>", the line the game takes from the
      clipboard. The address is yours to fill in; a tournament's matches are servers of their own, one port each.
    */

    playersKeyResults.innerHTML = '';

    if (isTournament()) {
      playersKeyResults.appendChild(resultBox({
        lang: 'bash',
        text: wrapped(printKeyCommand()),
        hint: `Not on the server list: give your players its address and this key.<br>Each match is a server of its own - ports ${portSpan(state.port)}.`
      }));
    }
    else {
      const more = instanceCount() > 1 ? '<br>It\'s the first server\'s - the others are on the next ports, with their names.' : '';

      playersKeyResults.appendChild(resultBox({
        lang: 'bash',
        text: printJoinCommand(),
        hint: 'This prints a line like <code>203.0.113.7,My server,0x8aed41f2...</code> - publish it.<br>Players who copy it get your server added to their favorites by the game.' + more
      }));
    }
    steps.playersKey.el.hidden = state.serverListOn;

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
    startHint.innerHTML = method() === 'run' ? `If it's running already, ${inline('sudo docker rm -f hypersomnia-server')} first.` : '';
    startHint.hidden = !startHint.innerHTML;
    fillStart(start);
    steps.service.el.hidden = !serviceBox;
    steps.secret.el.hidden = !secretResults.childElementCount;
    steps.secret.title.textContent = method() === 'compose' ? 'Your .env' : 'Your private config';
    updateFuseField(serviceBox);
    // its config's folder follows the settings
    updateBefore();
    updateProfileBox();
    updateScript();

    if (tocReady) {
      updateToc();
    }

    const errors = configErrors();
    const escaped = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    errorBox.hidden = errors.length === 0;
    errorBox.innerHTML = `<div class="gen-errors-title"><i class="fa-solid fa-triangle-exclamation"></i>Fix the errors in the settings first</div><ul>${errors.map(e => `<li>${escaped(e)}</li>`).join('')}</ul>`;
    mount.classList.toggle('gen-has-errors', errors.length > 0);

    // nor as instructions - the button is in the profile's tile, outside what the errors hide
    if (profileBoxReady) {
      instructionsButton.disabled = errors.length > 0;
      instructionsButton.title = errors.length > 0 ? 'Fix the errors in the settings first.' : 'Every step in one Markdown file\n- for a human or an LLM.';
    }
  }

  function startText() {
    return {
      run: dockerRun(),
      compose: 'sudo docker compose up -d',
      terminal: startCommand(),
      service: ownUser()
        ? 'sudo loginctl enable-linger "$(id -un)"\nsystemctl --user daemon-reload\nsystemctl --user enable hypersomnia\nsystemctl --user restart hypersomnia'
        : 'sudo systemctl daemon-reload\nsudo systemctl enable hypersomnia\nsudo systemctl restart hypersomnia'
    }[method()];
  }

  /*
    FUSE installed drops the --appimage-extract-and-run line from the AppImage's start - an empty line in its place
    keeps everything below where it was. Shown, never copied.
  */

  const reservesFuseLine = () => state.fuse && method() === 'terminal';
  // a newline alone at a block's end shows no line - a zero-width space after it does
  const reservedLine = () => el('span', { class: 'gen-no-copy', text: '\n\u200b' });

  function fillStart(start) {
    /*
      Wrapped only between the arguments, never inside one (e.g. at the dash of --tournament-arenas):
      every argument unbreakable (a quoted one whole), the spaces between them as they are - copying gives the same text.
      Each argument highlighted as bash on its own.
    */

    startCode.innerHTML = '';
    startCode.className = window.hljs ? 'hljs language-bash' : '';

    const highlighted = text => window.hljs ? window.hljs.highlight(text, { language: 'bash', ignoreIllegals: true }).value : null;

    // the variables above the command: short lines, each one string - highlighted as a whole
    const lines = (start || '').split('\n');

    for (;;) {
      // the empty lines between them as they are
      while (lines.length > 1 && lines[0] === '') {
        startCode.appendChild(document.createTextNode('\n'));
        lines.shift();
      }

      // its end: a quote not escaped - on its first line too (one arena)
      const closes = (l, i) => (i > 0 || l.indexOf('"') < l.length - 1) && /[^\\]"$/.test(l);
      const variableEnd = /^[A-Z]+="/.test(lines[0] || '') ? lines.findIndex(closes) : -1;

      if (variableEnd < 0) {
        break;
      }

      const block = el('span');
      const text = lines.slice(0, variableEnd + 1).join('\n');
      const html = highlighted(text);

      if (html !== null) {
        block.innerHTML = html;
      }
      else {
        block.textContent = text;
      }

      startCode.appendChild(block);
      startCode.appendChild(document.createTextNode('\n'));
      lines.splice(0, variableEnd + 1);
    }

    lines.forEach((line, i) => {
      if (i > 0) {
        startCode.appendChild(document.createTextNode('\n'));
      }

      (line.match(/(?:'[^']*'|"(?:\\.|[^"])*"|\S)+| +/g) || []).forEach(part => {
        if (/^ +$/.test(part)) {
          startCode.appendChild(document.createTextNode(part));
          return;
        }

        const arg = el('span', { class: 'gen-arg' });
        const html = highlighted(part);

        if (html !== null) {
          arg.innerHTML = html;
        }
        else {
          arg.textContent = part;
        }

        startCode.appendChild(arg);
      });
    });

    if (reservesFuseLine()) {
      startCode.appendChild(reservedLine());
    }
  }

  /*
    Profiles: the whole setup as a Markdown file - every step in order, ready to follow or to keep.
    Its Profile section is the JSON that loads back into the generator.
  */


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

  function profileMarkdown(withSecrets) {
    const block = (title, lang, text) => `## ${title}\n\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    const parts = [`# ${isTournament() ? 'Hypersomnia tournament' : (state.name || 'My server')} - ${setupName()}\n`, 'Made with https://hypersomnia.io/generator\n'];

    if (beforeText()) {
      parts.push(block(beforeTitle(), 'sh', beforeText()));
    }

    // in the order they are done: the setup, the files, the firewall, the start
    // a server.json of all defaults isn't needed - left out
    // docker run is in Your startup command
    outputsOf().filter(k => k !== 'firewall' && k !== 'run' && !(k === 'json' && !buildSettings().json)).forEach(k => {
      const o = outputOf(k);
      // its folder is made with the setup's commands
      parts.push(k === 'json' ? block(o.title, 'json', prettyJson(buildSettings().json)) : block(o.title, o.lang, o.text()));
    });

    // the secrets apart, as on the page
    const secrets = method() === 'compose' ? dotEnv() : method() === 'run' ? runEnvFile() : buildSettings().secrets;

    if (method() === 'compose' && secrets) {
      parts.push(block('.env', 'bash', secrets));
      parts.push(block('Restrict who can read the file', 'sh', 'chmod 600 .env'));
    }
    else if (method() === 'run' && secrets) {
      parts.push(block(RUN_ENV_FILE, 'bash', secrets));
      parts.push(block('Restrict who can read the file', 'sh', `chmod 600 ${RUN_ENV_FILE}`));
    }
    else if (secrets) {
      parts.push(block(privatePath(), 'json', prettyJson(secrets)));
      parts.push(block('Restrict who can read the file', 'sh', privateChmod()));
    }

    parts.push(block('Your firewall commands', 'sh', firewall()));

    if (startText()) {
      parts.push(block('Your startup command', 'sh', startText()));
    }
    // the profile itself, to read - the generator loads it from a .json file
    parts.push(`## Profile\n\nSaved as a \`.json\` file, it loads back into https://hypersomnia.io/generator.\n\n\`\`\`json\n${profileJson(withSecrets)}\n\`\`\`\n`);

    // all of the above in one script - with the script's own choices as they're set now
    const choices = [
      `firewall: ${state.firewall === 'none' ? 'left as it is' : state.firewall}`,
      `start now: ${scriptOptions.start ? 'yes' : 'no'}`
    ].concat(method() === 'compose' || method() === 'run' ? [`data folder: ${scriptOptions.dataFolder ? 'made' : 'there already'}`] : []);

    parts.push(block(`Single script (${choices.join(', ')})`, 'bash', oneShotScript()));

    return parts.join('\n');
  }

  /*
    The profile: the setup and only what differs from the defaults - never the secrets, so it's safe to share.
    The same JSON in the box above the bar, in a .json to save and load, and at the end of the instructions
    (there with the secrets when asked for).
  */

  const profileJson = (withSecrets = false) => {
    const changed = changedFromDefaults();

    if (!withSecrets) {
      SECRET_KEYS.forEach(k => { delete changed[k]; });
    }

    return JSON.stringify({ setup: currentSetup, settings: changed }, null, 2);
  };

  function download(text, type, file) {
    const blob = new Blob([text], { type });
    const a = el('a', { href: URL.createObjectURL(blob), download: file });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const profileName = () => 'hypersomnia-' + ((isTournament() ? 'tournament' : (state.name || 'server')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'server');

  // the secrets set - named as their fields in the form
  const SECRET_NAMES = {
    password: 'Join password',
    webhook: 'Discord webhook',
    telegramToken: 'Telegram bot token',
    tResultsWebhook: 'Results webhook'
  };

  const secretsIn = st => Object.keys(SECRET_NAMES).filter(k => {
    const value = st[k];
    return Array.isArray(value) ? value.length : (typeof value === 'string' && value.trim());
  });

  /*
    The instructions as the profile: without the secrets, their places say what goes there.
  */

  const SECRET_PLACEHOLDERS = {
    password: 'YOUR_PASSWORD',
    webhook: 'https://YOUR_DISCORD_WEBHOOK',
    tResultsWebhook: 'https://YOUR_RESULTS_WEBHOOK',
    telegramToken: 'YOUR_TELEGRAM_BOT_TOKEN'
  };

  function instructionsMarkdown(withSecrets) {
    if (withSecrets) {
      return profileMarkdown(true);
    }

    const real = state;
    state = Object.assign({}, real);

    Object.keys(SECRET_PLACEHOLDERS).forEach(k => {
      if (String(real[k]).trim()) {
        state[k] = SECRET_PLACEHOLDERS[k];
      }
    });

    try {
      return profileMarkdown(false);
    }
    finally {
      state = real;
    }
  }

  /*
    Saved with secrets set (the instructions, the profile): asked first whether they go into the file.
  */

  function askSecrets(save) {
    if (!secretsIn(state).length) {
      save(false);
      return;
    }

    const withButton = el('button', { type: 'button', class: 'gen-link-button gen-with-secrets', text: 'With secrets' });
    const withoutButton = el('button', { type: 'button', class: 'gen-link-button', text: 'Without secrets' });
    const cancelButton = el('button', { type: 'button', class: 'gen-link-button', text: 'Cancel' });

    const dismiss = showModal('Include your secrets?', [
      el('p', { class: 'gen-field-text', text: 'Contains:' }),
      el('ul', { class: 'gen-field-text gen-secrets-list' }, secretsIn(state).map(k => el('li', { text: SECRET_NAMES[k] }))),
      el('div', { class: 'gen-link-row gen-secrets-buttons' }, [withButton, withoutButton, cancelButton])
    ], true);

    withButton.addEventListener('click', () => { save(true); dismiss(); });
    withoutButton.addEventListener('click', () => { save(false); dismiss(); });
    cancelButton.addEventListener('click', dismiss);
  }

  const saveInstructions = () => askSecrets(withSecrets => download(instructionsMarkdown(withSecrets), 'text/markdown', profileName() + '.md'));
  const saveProfile = () => askSecrets(withSecrets => download(profileJson(withSecrets) + '\n', 'application/json', profileName() + '.json'));

  /*
    A profile into the form: checked (sanitizeState) - nothing in it reaches the commands unchecked.
    What it doesn't name is the default. Null: it's not a profile (the reason in the error).
  */

  let lastAppliedSecrets = [];
  let lastKeptSecrets = [];

  // far more than any profile - a paste beyond it isn't read (nor highlighted): it would freeze the tab
  const MAX_PROFILE_LENGTH = 100000;

  function applyProfile(text) {
    let parsed;

    if (text.length > MAX_PROFILE_LENGTH) {
      return 'Too long for a profile - nothing changed.';
    }

    try {
      parsed = JSON.parse(text);
    }
    catch (e) {
      return 'Not valid JSON - nothing changed.';
    }

    const notProfile =
      !parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || !parsed.settings || typeof parsed.settings !== 'object' || Array.isArray(parsed.settings)
    ;

    if (notProfile) {
      return 'Not a profile: expected { "setup": ..., "settings": { ... } } - nothing changed.';
    }

    // the secrets it doesn't name stay as they are - a profile without them doesn't wipe this browser's
    // the ones it has go into the form - and the box shows itself without them, so a note says where they went
    lastAppliedSecrets = secretsIn(parsed.settings);
    // and the ones it doesn't have, kept from this browser - said too: another server's webhook would go along unseen
    lastKeptSecrets = secretsIn(state).filter(k => !lastAppliedSecrets.includes(k));
    const secrets = {};
    SECRET_KEYS.forEach(k => { secrets[k] = state[k]; });
    state = sanitizeState(Object.assign({}, defaults, secrets, parsed.settings));

    // applied: what got through the checks (a password with a newline in it didn't)
    lastAppliedSecrets = lastAppliedSecrets.filter(k => state[k] === parsed.settings[k]);

    if (setupIds.includes(parsed.setup) && parsed.setup !== currentSetup) {
      // the tab's listeners refresh the inputs and the outputs
      selectSetup(parsed.setup);
    }
    else {
      refreshInputs();
      update();
    }

    return null;
  }

  function loadProfile(text) {
    const error = applyProfile(text);

    if (error) {
      alert(error);
    }
    else {
      profileText.value = profileJson();
      showProfile(profileText.value);
      showAppliedSecrets();
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

    // the page anew - the defaults, by definition
    location.replace(location.pathname);
  }

  const profileFile = el('input', { type: 'file', accept: '.json,application/json', hidden: 'hidden' });

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

  const saveProfileButton = profileButton('fa-solid fa-download', 'Save (.json)', saveProfile, 'The JSON above, as a file.');

  const profileBar = el('div', { class: 'btn-group gen-profile-bar' }, [
    saveProfileButton,
    profileButton('fa-solid fa-upload', 'Load (.json)', () => profileFile.click(), 'From a .json saved here.'),
    profileButton('fa-solid fa-rotate-left', 'Reset to defaults', resetToDefaults),
    profileFile
  ]);

  /*
    The profile as JSON, always in sight above the bar: what you changed. Edited or pasted, valid, it goes into the form
    at once; the form's changes come back into it. Highlighted by a copy of it underneath - the box itself is see-through.
  */

  const profileCode = el('code');
  const profilePre = el('pre', { class: 'gen-json-pre', 'aria-hidden': 'true' }, [profileCode]);
  const profileText = el('textarea', { class: 'gen-json-text', spellcheck: 'false', wrap: 'off', autocomplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-bwignore': 'true', 'aria-label': 'The profile as JSON' });
  const profileError = el('p', { class: 'gen-json-error' });
  // as the other code boxes: their background and colors
  const profileEditor = el('div', { class: 'guide-code gen-json-editor' }, [
    profilePre,
    profileText,
    // above the box - copies the profile as it's written there
    el('button', { type: 'button', class: 'guide-copy', title: 'Copy', html: '<i class="fa-regular fa-copy"></i>' })
  ]);
  // a tile as Check that it works: only the box in it is highlighted
  // what it is, for someone who sees it the first time
  const PROFILE_HELP = 'Only this generator reads it, never the server.';

  const profileSub = el('p', { class: 'gen-field-text gen-profile-sub', html: 'No need to edit the configs by hand later:<br>save this and come back to tweak the settings.<br><br>Safe to share - no passwords or webhooks.' });
  const profileApplied = el('p', { class: 'gen-field-text gen-profile-applied' });
  profileApplied.hidden = true;

  // a pasted or loaded profile's secrets: in the form now, not in the box
  function showAppliedSecrets() {
    const names = keys => keys.map(k => SECRET_NAMES[k]).join(', ');

    profileApplied.innerHTML = [
      lastAppliedSecrets.length ? `<i class="fa-solid fa-check gen-secure"></i>Secrets applied to the form: ${names(lastAppliedSecrets)}.` : '',
      lastKeptSecrets.length ? `<i class="fa-solid fa-circle-info gen-kept"></i>Kept from this browser: ${names(lastKeptSecrets)}.` : ''
    ].filter(Boolean).join('<br>');

    profileApplied.hidden = !lastAppliedSecrets.length && !lastKeptSecrets.length;
  }

  const profileBody = el('div', { class: 'gen-step-body' }, [
    profileSub,
    profileEditor,
    profileError,
    profileApplied
  ]);
  const profileBox = el('div', { class: 'gen-step gen-profile-box' }, [
    el('div', { class: 'gen-step-head' }, [el('span', { class: 'gen-step-title' }, [
      document.createTextNode('Your generator profile '),
      el('i', { class: 'fa-regular fa-circle-question gen-row-help', 'data-tip': PROFILE_HELP, 'aria-label': PROFILE_HELP, tabindex: '0' })
    ])]),
    profileBody
  ]);

  function showProfile(text) {
    // a last empty line would show no line - a space after it does
    profileCode.textContent = text + '\n ';

    if (text.length <= MAX_PROFILE_LENGTH) {
      highlight(profileCode, 'json');
    }

    profileCode.dataset.copy = text;
  }

  let profileTimer = null;

  profileText.addEventListener('input', () => {
    showProfile(profileText.value);
    clearTimeout(profileTimer);

    profileTimer = setTimeout(() => {
      const error = applyProfile(profileText.value);

      if (!error) {
        showAppliedSecrets();
      }

      profileError.textContent = error || '';
      profileError.hidden = !error;
      profileEditor.classList.toggle('gen-bad', !!error);
    }, 400);
  });

  // the copy underneath scrolls with the box
  profileText.addEventListener('scroll', () => {
    profilePre.scrollTop = profileText.scrollTop;
    profilePre.scrollLeft = profileText.scrollLeft;
  });

  // a valid profile typed in comes back formatted once the box is left
  profileText.addEventListener('blur', () => {
    if (!profileEditor.classList.contains('gen-bad')) {
      profileText.value = profileJson();
      showProfile(profileText.value);
    }
  });

  function updateProfileBox() {
    if (!profileBoxReady || document.activeElement === profileText) {
      return;
    }

    // the form changed since - the note was about the paste
    profileApplied.hidden = true;

    profileText.value = profileJson();
    showProfile(profileText.value);
    profileError.hidden = true;
    profileEditor.classList.remove('gen-bad');
  }

  // under everything: the profile, then its buttons
  // the instructions apart from the bar: they don't change the profile
  const instructionsButton = el('button', { type: 'button', class: 'gen-link-button', html: '<i class="fa-solid fa-file-lines"></i>Save complete instructions (.md)', title: 'Every step in one Markdown file\n- for a human or an LLM.' });
  instructionsButton.addEventListener('click', saveInstructions);
  const profileLinks = el('div', { class: 'gen-link-row gen-profile-links' }, [instructionsButton]);

  // its buttons in its tile, under the box - then the instructions
  profileBody.append(profileBar, profileLinks);
  mount.after(profileBox);
  profileBoxReady = true;
  updateProfileBox();

  /*
    A table of contents on the left, where the page has room for it: the settings, the configs, the check, the profile.
    A click scrolls there; the one being read is marked.
  */

  const toc = el('nav', { class: 'gen-toc', 'aria-label': 'Contents' });
  document.body.appendChild(toc);
  let tocTargets = [];
  let tocPinned = null;

  function updateToc() {
    // the four parts of the page - the steps themselves change with the setup and the view
    const entries = [
      { label: 'Settings', target: steps.configure.el },
      { label: 'Your configs', target: generatedLine },
      { label: 'Check that it works', target: steps.check.el },
      { label: 'Your generator profile', target: profileBox }
    ];

    tocTargets = entries.map(e => e.target);

    toc.innerHTML = '';
    entries.forEach(e => {
      const a = el('a', { href: '#', text: e.label });

      a.addEventListener('click', ev => {
        ev.preventDefault();
        // marked as clicked - near the page's end it can't come up to the top, and would look unreached
        tocPinned = entries.indexOf(e);
        e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        markToc();
      });

      toc.appendChild(a);
    });

    markToc();
  }

  function markToc() {
    if (tocPinned !== null) {
      [...toc.children].forEach((a, i) => a.classList.toggle('active', i === tocPinned));
      return;
    }

    // the last section whose top has passed the upper part of the window
    let current = 0;

    // at the page's end the last ones never reach it - then the last one in sight
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const line = atEnd ? window.innerHeight : window.innerHeight * 0.3;

    tocTargets.forEach((t, i) => {
      if (t.getBoundingClientRect().top < line) {
        current = i;
      }
    });

    [...toc.children].forEach((a, i) => a.classList.toggle('active', i === current));
  }

  window.addEventListener('scroll', markToc, { passive: true });

  // scrolled by hand: the mark follows the page again
  ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach(type => window.addEventListener(type, ev => {
    if (!toc.contains(ev.target)) {
      tocPinned = null;
    }
  }, { passive: true }));

  tocReady = true;
  updateToc();

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
