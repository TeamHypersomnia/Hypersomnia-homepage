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
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    Object.assign(state, saved);

    // saved before the password had its switch
    if (saved.password && saved.passwordOn === undefined) {
      state.passwordOn = true;
    }
  }
  catch (e) {}

  /*
    Each input re-reads its value when the tab changes - a saved profile or the defaults may differ.
  */
  const refreshers = [];
  const refreshInputs = () => refreshers.forEach(f => f());

  // the password is behind its switch
  const password = () => state.passwordOn ? state.password : '';

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
      const remove = el('button', { type: 'button', class: 'gen-chip-remove', title: 'Remove', html: '&times;' });
      remove.addEventListener('click', () => set(state.cycle.filter((_, j) => j !== i)));

      const c = el('span', { class: 'gen-chip', draggable: 'true' }, [
        el('span', { class: 'gen-chip-no', text: String(i + 1) }),
        el('span', { text: name }),
        remove
      ]);

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

  // four example teams of the chosen size: alice / bob / ... or "alice, bob, carol" per line
  function examplePlayers() {
    const names = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'gus', 'hal', 'ivy', 'jo', 'kim', 'leo', 'mia', 'ned', 'oli', 'pat', 'quin', 'rex', 'sam', 'tom'];
    const lines = [];

    for (let t = 0; t < 4; ++t) {
      lines.push(names.slice(t * state.tTeamSize, (t + 1) * state.tTeamSize).join(', '));
    }

    return lines.join('\n');
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

  const teamsText = el('textarea', { rows: '4', placeholder: 'alice\nbob\ncarol\ndave' });

  pairingSelect.value = state.tPairing;
  teamsText.value = state.tTeamsText;

  pairingSelect.addEventListener('change', () => { state.tPairing = pairingSelect.value; update(); });
  teamsText.addEventListener('input', () => { state.tTeamsText = teamsText.value; update(); });

  const playersInput = sliderInput('tPlayers', 2, 64);
  const teamSize = teamSizeSelect();

  function updatePairing() {
    const beforehand = state.tPairing === 'beforehand';

    teamsText.hidden = !beforehand;
    pairingPreview.hidden = !beforehand;
    teamsText.placeholder = examplePlayers();

    if (beforehand) {
      updatePairingPreview();
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

  function updateCheck() {
    if (isTournament() && state.tPairing === 'beforehand') {
      checkText.innerHTML = 'Players on your network see every match under <strong>Ongoing Tournament</strong> in <code>Browse servers</code>.<br>Players must join the server that mentions their team/nickname:';
      checkImage.src = '/assets/images/generator/server_browser_tournament.png';
      checkImage.alt = 'The tournament\'s matches in Browse servers';
    }
    else if (isTournament()) {
      checkText.innerHTML = 'Players on your network see every match under <strong>Ongoing Tournament</strong> in <code>Browse servers</code>.<br>Until it is full, a match says <code>(any pair)</code> - anyone may join it.<br>Then it is named by its players:';
      checkImage.src = '/assets/images/generator/server_browser_tournament_open.png';
      checkImage.alt = 'The tournament\'s matches in Browse servers';
    }
    else {
      checkText.innerHTML = 'Within a minute your server is on <a href="/servers" target="_blank">hypersomnia.io/servers</a> and in <code>Browse servers</code> in the game.<br>On the list but nobody can join?<br>Open the ports - see <code>Your firewall commands</code> above.';
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

  const tablePort = numberInput('port', 1024, 65000, false);
  const tableWebPort = numberInput('webPort', 1024, 65000, false);
  const tableWebHead = el('span', { class: 'gen-ports-head', html: '<i class="fa-solid fa-globe"></i>Browser' });

  const portsRow = foldRow('Ports', 'Change them only if 8412 or 9000 is taken on this machine.', el('div', { class: 'gen-ports' }, [
    el('span', { class: 'gen-ports-head', html: '<i class="fa-solid fa-gamepad"></i>Game' }),
    tableWebHead,
    tablePort,
    tableWebPort
  ]));

  const adminRow = revealRow('Admin', 'adminOn', admins, 'In the game: Settings → Account. Lets you manage the server in-game: maps, bans...');
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

  const pairingRow = settingRow('Player pairings', [pairingSelect]);

  // however they join first: what it means for the players
  const firstText = el('p', { class: 'gen-field-text', html: 'Players join <strong>any server</strong> they want <em>in the first round</em>.<br>They can use <strong>any nicknames</strong> they like.<br>In later rounds, they will be paired automatically.' });

  // set up beforehand: the list and how it was understood - the rounds say it better than any explanation
  const nicknamesText = el('p', { class: 'gen-field-text', text: 'Players set these exact nicknames to be let in.' });
  pairingRow.appendChild(el('div', { class: 'gen-row-editor' }, [firstText, teamsText, pairingPreview, nicknamesText]));

  const playersRow = settingRow('Players', [playersInput, roundSummary]);

  const defaultRoundMaps = () => roundMaps().map((_, i) => i % 2 === 0 ? 'de_cyberaqua' : 'de_silo');
  const mapsRow = foldRow('Maps for each stage', '', roundsBox);

  const serverRows = [];
  const tournamentRows = [];
  const only = (list, row) => {
    list.push(row);
    return row;
  };

  const serverTable = el('div', { class: 'gen-table' }, [
    only(serverRows, settingRow('Server name', [textInput('name', 'My server')])),
    only(serverRows, cycleRow),
    only(serverRows, settingRow('Slots', [sliderInput('slots', 4, 26)])),
    only(serverRows, settingRow('Server instances', [casualInput], 'If hosting multiple instances, they will take subsequent ports.')),
    only(tournamentRows, settingRow('Teams', [teamSize])),
    only(tournamentRows, pairingRow),
    only(tournamentRows, playersRow),
    only(tournamentRows, mapsRow),
    settingRow('Browser players', [switchInput('browser', () => {}, 'from <a href="https://play.hypersomnia.io" target="_blank">play.hypersomnia.io</a>')]),
    portsRow,
    revealRow('Join password', 'passwordOn', textInput('password', 'the password'), 'Without it, anyone can join.'),
    only(serverRows, adminRow)
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
    pairingRow.classList.add('open');
    firstText.hidden = pairedBeforehand();
    nicknamesText.hidden = !pairedBeforehand();

    const maps = roundMaps();
    mapsRow.show(maps.join(' <span class="gen-arrow">→</span> '), JSON.stringify(maps) === JSON.stringify(defaultRoundMaps()));

    cycleRow.show(
      state.cycle.length
        ? state.cycle.join(' <span class="gen-arrow">→</span> ') + (state.cycle.length > 1 ? `<span class="gen-summary-tag">${state.cycleRandom ? 'random order' : 'in order'}</span>` : '')
        : 'de_cyberaqua only',
      cycleIsDefault()
    );

    portsRow.show(
      `${portSpan(state.port)} UDP` + (state.browser ? `, ${portSpan(state.webPort)} UDP` : ''),
      state.port === 8412 && state.webPort === 9000
    );

    tableWebPort.hidden = !state.browser;
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

  const formRoot = el('form', { autocomplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-bwignore': 'true' }, [serverForm]);
  formRoot.addEventListener('submit', e => e.preventDefault());

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
  [steps.config, steps.secret, steps.before, steps.service, steps.firewall, steps.start, steps.check].forEach(st => mount.appendChild(st.el));


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

    // server_private goes into its own file - the config can be shown to anyone
    const secrets = {};

    if (ids.length && !isTournament()) {
      secrets.admin_profiles = ids.map(account => ({ account, rcon: 'MASTER_RCON' }));
    }

    if (password()) {
      secrets.server_password = password();
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

  // a .env line: single quotes keep the value as it is
  function envLine(k, v) {
    const quoted = v.includes("'") ? JSON.stringify(v) : `'${v}'`;
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

    if (ids.length && !isTournament()) {
      put('HYPERSOMNIA_ADMINS', ids.join(','));
    }

    if (password()) {
      put('HYPERSOMNIA_PASSWORD', password());
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
      if (SECRET_VARS.includes(k)) {
        lines.push(`      ${k}: \${${k}}`);
      }
      else if (v.includes('\n')) {
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
    updatePortRows();
    updateTable();

    const n = instanceCount();
    const ports = state.browser ? `UDP ${portSpan(state.port)} and ${portSpan(state.webPort)}` : `UDP ${portSpan(state.port)}`;

    // what the ports are for - told in Setup the firewall
    const forWhat = isTournament() ? ' (one each per match server)' : n > 1 ? ' (one each per server)' : '';

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
      hint: `Open ${ports}${forWhat} in the system firewall - and in your cloud provider's panel, if it has one.`
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
      alert('Not instructions saved by the generator - it has no "' + PROFILE_MARK + '" line at the end.');
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

  const profileButton = (icon, text, onClick, tooltip = '') => {
    const b = el('button', { type: 'button', html: `<i class="${icon}"></i>${text}` });

    if (tooltip) {
      b.title = tooltip;
    }

    b.addEventListener('click', onClick);
    return el('div', { class: 'btn' }, [b]);
  };

  const profileBar = el('div', { class: 'btn-group gen-profile-bar' }, [
    profileButton('fa-solid fa-download', 'Save complete instructions', saveProfile, 'A Markdown file with every step - you can give it to your LLM.'),
    profileButton('fa-solid fa-upload', 'Load from instructions', () => profileFile.click()),
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

    tooltip.textContent = target.dataset.tip;
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
