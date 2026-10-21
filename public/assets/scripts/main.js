function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const WEAPON_CATEGORIES = {
  pistols: ["sn69", "kek9", "bulwark", "calico", "covert", "ao44", "deagle"],
  rifles: ["galilea", "hunter", "vindicator", "bilmik", "bilmer2000", "baka47", "szturm", "datum", "bulldup2000", "awka", "amplifier_arm"],
  submachineGuns: ["szczur", "zamiec", "cyberspray", "pro90"],
  heavyGuns: ["lews", "elon", "blunaz"],
  shotguns: ["gradobicie", "warx", "szkwal"],
};

/*
  Pixel art stays crisp only at a whole number of screen pixels per image pixel.
  With e.g. 125% system scaling the browser would draw the sprites 1.25x - shrink them back to 1:1,
  and at 200% keep them at 2:1. Again whenever zooming changes the device pixel ratio.
*/
function fitWeaponSpritesToScreenPixels() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.max(1, Math.floor(dpr)) / dpr;

  document.querySelectorAll(".weapon-sprite").forEach(el => {
    el.style.zoom = scale;
  });

  matchMedia(`(resolution: ${dpr}dppx)`).addEventListener("change", fitWeaponSpritesToScreenPixels, { once: true });
}

function initFirearms() {
  const table = document.querySelector("#firearms");
  if (!table) return;

  fitWeaponSpritesToScreenPixels();

  const fastBtn = document.querySelector(".fastBtn");
  const strongBtn = document.querySelector(".strongBtn");

  function toggleAmmoType(type) {
    const isFast = type === "fast";

    fastBtn?.classList.toggle("active", isFast);
    strongBtn?.classList.toggle("active", !isFast);

    document.querySelectorAll(".fast").forEach(el => {
      el.style.display = isFast ? "inline" : "none";
    });
    document.querySelectorAll(".strong").forEach(el => {
      el.style.display = isFast ? "none" : "inline";
    });
  }

  fastBtn?.addEventListener("click", () => toggleAmmoType("fast"));
  strongBtn?.addEventListener("click", () => toggleAmmoType("strong"));

  function filterWeapons(category) {
    const rows = table.querySelectorAll("tbody tr");
    const buttons = document.querySelectorAll(".firearms .btn button");
    const list = WEAPON_CATEGORIES[category];

    rows.forEach(row => {
      const visible = category === "all" || list?.includes(row.dataset.id);
      row.style.display = visible ? "" : "none";
    });

    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.classList.contains(category));
    });
  }

  const categoryMap = ["all", "pistols", "rifles", "submachineGuns", "heavyGuns", "shotguns"];

  categoryMap.forEach(category => {
    document.querySelector(`.${category}`)?.addEventListener("click", () => filterWeapons(category));
  });
}

const LEADERBOARD_MODES = {
  bomb_defusal: "/leaderboards/bomb-defusal",
  ffa: "/leaderboards/ffa",
};

const RANK_MEDALS = ["🏆", "🥈", "🥉"];

function buildLeaderboardRow(player, index) {
  const rank = RANK_MEDALS[index] ?? index + 1;
  const rankImg = `https://cdn.jsdelivr.net/gh/TeamHypersomnia/Hypersomnia/hypersomnia/content/gfx/necessary/${player.rankImg}`;
  const profile = `/user/${player.account_id}`;
  const name = String(player.nickname).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const total = player.matches_won + player.matches_lost;
  const winRate = total === 0 ? "0%" : `${Math.round((player.matches_won / total) * 100)}%`;
  const wlDiff = player.matches_won - player.matches_lost;

  return `
    <tr>
      <td>${rank}</td>
      <td><a href="${profile}"><img class="rank" src="${rankImg}" alt="">${name}</a></td>
      <td>${player.mmr.toFixed(2)}</td>
      <td>${player.mu.toFixed(3)}</td>
      <td>${player.sigma.toFixed(3)}</td>
      <td data-sort="${wlDiff}">${player.matches_won}-${player.matches_lost}</td>
      <td>${winRate}</td>
    </tr>`;
}

function buildLeaderboardTable(players) {
  const rows = players.map(buildLeaderboardRow).join("");
  return `
    <table class="sortable maxwidth big">
      <thead>
        <tr>
          <th class="dir-u" width="10%">#</th>
          <th width="40%">Name</th>
          <th width="10%"><abbr title="Match Making Rating">MMR</abbr></th>
          <th width="10%">Mu</th>
          <th width="10%">Sigma</th>
          <th width="10%"><abbr title="Wins-Losses">W-L</abbr></th>
          <th width="10%"><abbr title="Win-To-Loss Ratio">WTLR</abbr></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function setButtonsLoading(buttons, loadingBtn) {
  buttons.forEach(btn => {
    btn.classList.remove("active");
    btn.disabled = true;
  });
  // The label stays where it is - a spinner to its left, taking no room of its own
  if (loadingBtn) {
    loadingBtn.classList.add("active");
    const label = loadingBtn.querySelector("span") || loadingBtn;
    const spinner = document.createElement("span");
    spinner.className = "btn-spinner";
    spinner.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    label.classList.add("btn-spinner-anchor");
    label.prepend(spinner);
  }
}

function resetButtons(buttons, activeBtn) {
  buttons.forEach(btn => {
    btn.disabled = false;
    btn.querySelectorAll(".btn-spinner").forEach(spinner => spinner.remove());
  });
  if (activeBtn) activeBtn.disabled = true;
}

async function leaderboards(mode) {
  const container = document.querySelector("#leaderboard");
  if (!container || !LEADERBOARD_MODES[mode]) return;

  const buttons = document.querySelectorAll(".btn button");
  const activeBtn = document.querySelector(`.${mode}`);

  setButtonsLoading(buttons, activeBtn);
  history.replaceState({ mode }, "", LEADERBOARD_MODES[mode]);

  try {
    const res = await fetch(`${LEADERBOARD_MODES[mode]}?format=json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const players = await res.json();
    container.innerHTML = buildLeaderboardTable(players);
    resetButtons(buttons, activeBtn);
  } catch (err) {
    console.error("Failed to load leaderboard:", err);
    container.innerHTML = `
      <div class="alert" style="border-color:rgba(248,94,115,.3);color:#f85e73;background:linear-gradient(135deg,rgba(248,94,115,.15),rgba(248,94,115,.1))">
        <i class="fa-solid fa-triangle-exclamation"></i> Failed to load leaderboard data. Please try again.
      </div>`;
    resetButtons(buttons, null);
  }
}

function initLeaderboard() {
  if (!document.querySelector("#leaderboard")) return;
  window.leaderboards = leaderboards;
}

function initSortableTables() {
  document.addEventListener("click", e => {
    try {
      const th = e.target.closest("th");
      if (!th) return;

      const thead = th.closest("thead");
      const table = th.closest("table.sortable");
      if (!thead || !table || th.classList.contains("no-sort")) return;

      const useAlt = e.shiftKey || e.altKey;
      const getCellValue = cell => useAlt
        ? cell.dataset.sortAlt
        : (cell.dataset.sort ?? cell.textContent);

      const headerRow = thead.rows[0];
      let colIndex = parseInt(th.dataset.sortCol);

      Array.from(headerRow.cells).forEach((cell, i) => {
        if (cell === th) {
          colIndex = isNaN(colIndex) ? i : colIndex;
        } else {
          cell.classList.remove("dir-u", "dir-d");
        }
      });

      const ascending = !th.classList.contains("dir-d") &&
        !(table.classList.contains("asc") && !th.classList.contains("dir-u"));
      const dir = ascending ? "dir-d" : "dir-u";

      th.classList.remove("dir-u", "dir-d");
      th.classList.add(dir);

      const tiebreakCol = parseInt(th.dataset.sortTbr);
      const nLast = table.classList.contains("n-last");

      const compare = (a, b, col) => {
        const va = getCellValue(a.cells[col]);
        const vb = getCellValue(b.cells[col]);

        if (nLast) {
          if (va === "" && vb !== "") return -1;
          if (vb === "" && va !== "") return 1;
        }

        const diff = Number(va) - Number(vb);
        return isNaN(diff) ? va.localeCompare(vb) : diff;
      };

      Array.from(table.tBodies).forEach(tbody => {
        const rows = Array.from(tbody.rows).sort((a, b) => {
          const primary = compare(a, b, colIndex);
          if (primary !== 0) return ascending ? primary : -primary;
          return isNaN(tiebreakCol) ? 0 : compare(a, b, tiebreakCol);
        });

        const clone = tbody.cloneNode(false);
        clone.append(...rows);
        table.replaceChild(clone, tbody);
      });
    } catch (err) {
      console.error("Sortable table error:", err);
    }
  });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", e => {
      const id = link.getAttribute("href");
      if (id === "#") return;

      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ block: "start" });
      }
    });
  });
}

function initLazyImages() {
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      if (img.dataset.src) {
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
      }
      obs.unobserve(img);
    });
  });

  document.querySelectorAll("img[data-src]").forEach(img => observer.observe(img));
}

function initArenaViews() {
  const buttons = document.querySelectorAll(".view-switch button");
  if (!buttons.length) return;

  const apply = view => {
    buttons.forEach(b => b.classList.toggle("active", b.dataset.view === view));
    document.querySelectorAll(".arena-view").forEach(el => {
      el.hidden = el.dataset.view !== view;
    });
  };

  let saved = null;
  try { saved = localStorage.getItem("arenasView"); } catch (_) {}
  apply(saved === "grid" ? "grid" : "list");

  buttons.forEach(b => b.addEventListener("click", () => {
    apply(b.dataset.view);
    try { localStorage.setItem("arenasView", b.dataset.view); } catch (_) {}
  }));
}

/* [Copy] buttons next to server addresses */
function initCopyButtons() {
  document.addEventListener("click", async e => {
    const btn = e.target.closest(".copy-btn[data-copy]");
    if (!btn) return;

    const text = btn.dataset.copy;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (_) {
      /* no clipboard API (plain http): fall back to a hidden textarea */
      const ta = Object.assign(document.createElement("textarea"), { value: text });
      document.body.append(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch (_) {}
      ta.remove();
    }

    const icon = btn.querySelector("i");
    icon.className = ok ? "fa-solid fa-check" : "fa-solid fa-xmark";
    btn.classList.toggle("copied", ok);
    clearTimeout(btn.resetTimer);
    btn.resetTimer = setTimeout(() => {
      icon.className = "fa-regular fa-copy";
      btn.classList.remove("copied");
    }, 1200);
  });
}

/*
  A server key cut in the middle: CSS's ellipsis hides whole characters and leaves the rest of the box empty
  before the key's end - so the start is cut here to as many characters as fit, the ellipsis right before the end.
*/
function initServerKeys() {
  const keys = [...document.querySelectorAll(".server-key")];
  if (keys.length === 0) return;

  const fit = () => keys.forEach(key => {
    const start = key.querySelector(".server-key-start");
    const end = key.querySelector(".server-key-end");
    const cell = key.parentElement;
    const full = start.dataset.full || (start.dataset.full = start.textContent);
    const style = getComputedStyle(cell);
    const room = cell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - end.offsetWidth;

    start.style.overflow = "visible";
    start.style.flexShrink = "0";
    start.textContent = full;

    if (start.offsetWidth <= room) {
      start.style.overflow = "";
      start.style.flexShrink = "";
      return;
    }

    let fits = 0;

    for (let low = 1, high = full.length - 1; low <= high;) {
      const mid = (low + high) >> 1;
      start.textContent = full.slice(0, mid) + "…";

      if (start.offsetWidth <= room) {
        fits = mid;
        low = mid + 1;
      }
      else {
        high = mid - 1;
      }
    }

    start.textContent = full.slice(0, Math.max(fits, 1)) + "…";
    start.style.overflow = "";
    start.style.flexShrink = "";
  });

  fit();
  // Measured again with the page's font - a fallback one is narrower
  if (document.fonts) document.fonts.ready.then(fit);
  window.addEventListener("resize", debounce(fit, 100));
}

initFirearms();
initLeaderboard();
initCopyButtons();
initSortableTables();
initSmoothScroll();
initLazyImages();
initArenaViews();
initServerKeys();

window.hypersomniaUtils = { debounce };