/* ============================================================
   Hypersomnia — main.js
   ============================================================ */

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Returns a debounced version of `fn` that fires after `delay` ms of silence.
 * @param {Function} fn
 * @param {number} delay
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------------------------------------------------------------------------
// Firearms page
// ---------------------------------------------------------------------------

const WEAPON_CATEGORIES = {
  pistols: ["Sn69", "Kek9", "Bulwark", "Calico", "Ao44", "Covert", "Deagle"],
  rifles: ["Galilea", "Hunter", "Baka47", "Datum", "Amplifier arm", "Awka", "BullDup 2000", "Bilmer2000", "Szturm"],
  submachineGuns: ["Szczur", "Zamieć", "Cyberspray", "Pro90"],
  heavyGuns: ["Lews II", "Rocket Launcher ELON"],
  shotguns: ["Gradobicie", "Warx"],
};

function initFirearms() {
  const table = document.querySelector("#firearms");
  if (!table) return;

  // --- Ammo-type toggle ---

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

  // --- Category filter ---

  function filterWeapons(category) {
    const rows = table.querySelectorAll("tbody tr");
    const buttons = document.querySelectorAll(".firearms .btn button");
    const list = WEAPON_CATEGORIES[category];

    rows.forEach(row => {
      const name = row.querySelector("td")?.innerText.trim() ?? "";
      const visible = category === "all" || list?.includes(name);
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

// ---------------------------------------------------------------------------
// Leaderboard page
// ---------------------------------------------------------------------------

const LEADERBOARD_MODES = {
  bomb_defusal: "/leaderboards/bomb-defusal",
  ffa: "/leaderboards/ffa",
};

const RANK_MEDALS = ["🏆", "🥈", "🥉"];

function buildLeaderboardRow(player, index) {
  const rank = RANK_MEDALS[index] ?? index + 1;
  const rankImg = `https://cdn.jsdelivr.net/gh/TeamHypersomnia/Hypersomnia/hypersomnia/content/gfx/necessary/${player.rankImg}`;
  const profile = `/user/${player.account_id}`;
  const name = player.nickname.replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    <table class="sortable maxwidth">
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
    btn.dataset.originalText = btn.textContent;
  });
  if (loadingBtn) {
    loadingBtn.classList.add("active");
    loadingBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
  }
}

function resetButtons(buttons, activeBtn) {
  buttons.forEach(btn => {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText;
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

// ---------------------------------------------------------------------------
// Sortable tables
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Smooth-scroll for anchor links
// ---------------------------------------------------------------------------

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", e => {
      const id = link.getAttribute("href");
      if (id === "#") return;

      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Lazy-load images
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scroll-reveal animations
// ---------------------------------------------------------------------------

function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".dl, .sv-row-card, .arenas > a").forEach(el => {
    Object.assign(el.style, {
      opacity: "0",
      transform: "translateY(20px)",
      transition: "opacity 0.6s ease, transform 0.6s ease",
    });
    observer.observe(el);
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

initFirearms();
initLeaderboard();
initSortableTables();
initSmoothScroll();
initLazyImages();
initScrollReveal();

window.hypersomniaUtils = { debounce };