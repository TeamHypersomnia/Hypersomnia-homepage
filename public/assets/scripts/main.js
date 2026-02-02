document.addEventListener('DOMContentLoaded', () => {
  const CONFIG = {
    interFontUrl: "https://cdn.jsdelivr.net/npm/inter-ui/inter.min.css",
    assetBaseUrl: "https://cdn.gh/TeamHypersomnia/Hypersomnia/hypersomnia/content/gfx/necessary/",
    weaponCategories: {
      pistols: ["Sn69", "Kek9", "Bulwark", "Calico", "Ao44", "Covert", "Deagle"],
      rifles: ["Galilea", "Hunter", "Baka47", "Datum", "Amplifier arm", "Awka", "BullDup 2000", "Bilmer2000", "Szturm"],
      submachineGuns: ["Szczur", "Zamieć", "Cyberspray", "Pro90"],
      heavyGuns: ["Lews II", "Rocket Launcher ELON"],
      shotguns: ["Gradobicie", "Warx"]
    }
  };

  // Font Loading
  const setupFontLoading = () => {
    if (window.innerWidth < 768) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CONFIG.interFontUrl;
    document.head.appendChild(link);

    const root = document.documentElement.style;
    root.setProperty("--main-font", '"Inter", system-ui, -apple-system, sans-serif');
    root.setProperty("--main-features", '"cv02", "cv03", "cv04", "cv11"');
  };

  // Smooth Scrolling
  const setupSmoothScroll = () => {
    document.addEventListener("click", (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;

      const targetId = anchor.getAttribute("href");
      const target = document.querySelector(targetId);
      
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  };

  // Table Sorting - FIXED
  const setupTableSorting = () => {
    document.addEventListener("click", (e) => {
      const th = e.target.closest("th");
      
      // Fix: Check if th exists before proceeding
      if (!th) return;
      
      const table = th.closest("table.sortable");
      if (!table || !table.tBodies[0]) return;

      const tbody = table.tBodies[0];
      const rows = Array.from(tbody.rows);
      const colIdx = th.cellIndex;
      const isAscending = th.classList.contains("dir-u");

      // Sort rows
      rows.sort((a, b) => {
        const aCell = a.cells[colIdx];
        const bCell = b.cells[colIdx];
        
        if (!aCell || !bCell) return 0;
        
        const aVal = aCell.dataset.sort || aCell.textContent.trim();
        const bVal = bCell.dataset.sort || bCell.textContent.trim();
        
        return isAscending
          ? bVal.localeCompare(aVal, undefined, { numeric: true })
          : aVal.localeCompare(bVal, undefined, { numeric: true });
      });

      // Update sort indicators
      table.querySelectorAll("th").forEach(header => {
        header.classList.remove("dir-u", "dir-d");
      });

      th.classList.add(isAscending ? "dir-d" : "dir-u");
      
      // Reorder rows
      rows.forEach(row => tbody.appendChild(row));
    });
  };

  // Firearms Filter
  const initFirearmsFilter = () => {
    const section = document.querySelector("#firearms");
    if (!section) return;

    section.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      // Handle fast/strong toggle
      if (btn.classList.contains("fastBtn") || btn.classList.contains("strongBtn")) {
        const type = btn.classList.contains("fastBtn") ? "fast" : "strong";

        ["fast", "strong"].forEach(t => {
          const isActive = t === type;
          const toggleBtn = section.querySelector(`.${t}Btn`);
          
          if (toggleBtn) {
            toggleBtn.classList.toggle("active", isActive);
          }

          section.querySelectorAll(`.${t}`).forEach(el => {
            el.style.display = isActive ? "inline" : "none";
          });
        });
        return;
      }

      // Handle category filter
      const category = Array.from(btn.classList).find(c => 
        CONFIG.weaponCategories[c] || c === "all"
      );

      if (category) {
        section.querySelectorAll("tbody tr").forEach(row => {
          const nameCell = row.cells[0];
          if (!nameCell) return;
          
          const name = nameCell.innerText.trim();
          const visible = category === "all" || 
                         (CONFIG.weaponCategories[category] && 
                          CONFIG.weaponCategories[category].includes(name));
          
          row.style.display = visible ? "" : "none";
        });

        section.querySelectorAll(".btn button").forEach(b => {
          b.classList.toggle("active", b === btn);
        });
      }
    });
  };

  // Leaderboards
  const initLeaderboards = () => {
    const container = document.querySelector("#leaderboard");
    if (!container) return;

    const loadData = async (mode) => {
      const navButtons = document.querySelectorAll(".leaderboard-nav button");
      const activeBtn = document.querySelector(`.${mode}`);

      // Store original labels and disable buttons
      navButtons.forEach(btn => {
        btn.disabled = true;
        btn.dataset.label = btn.textContent;
      });

      if (activeBtn) {
        activeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
      }

      try {
        const endpoint = `/leaderboards/${mode.replace("_", "-")}?format=json`;
        const res = await fetch(endpoint);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        history.replaceState({ mode }, "", `/leaderboards/${mode.replace("_", "-")}`);
        renderTable(data);
      } catch (err) {
        console.error("Leaderboard error:", err);
        container.innerHTML = '<div class="alert">Failed to load leaderboard data. Please try again.</div>';
      } finally {
        // Re-enable buttons and restore labels
        navButtons.forEach(btn => {
          btn.disabled = false;
          btn.textContent = btn.dataset.label;
        });
        
        if (activeBtn) {
          activeBtn.disabled = true;
        }
      }
    };

    const renderTable = (players) => {
      const medals = ["🏆", "🥈", "🥉"];
      
      const rows = players.map((player, index) => {
        const total = player.matches_won + player.matches_lost;
        const winRate = total === 0 ? "0%" : `${Math.round((player.matches_won / total) * 100)}%`;
        const wlDiff = player.matches_won - player.matches_lost;
        const rankDisplay = medals[index] || (index + 1);
        const escapedNickname = escapeHtml(player.nickname);

        return `
          <tr>
            <td>${rankDisplay}</td>
            <td>
              <a href="/user/${player.account_id}">
                <img class="rank" src="${CONFIG.assetBaseUrl}${player.rankImg}" alt="Rank">
                ${escapedNickname}
              </a>
            </td>
            <td>${player.mmr.toFixed(2)}</td>
            <td>${player.mu.toFixed(3)}</td>
            <td>${player.sigma.toFixed(3)}</td>
            <td data-sort="${wlDiff}">${player.matches_won}-${player.matches_lost}</td>
            <td>${winRate}</td>
          </tr>
        `;
      }).join("");

      container.innerHTML = `
        <table class="sortable maxwidth">
          <thead>
            <tr>
              <th class="dir-u" width="10%">#</th>
              <th width="40%">Name</th>
              <th width="10%">MMR</th>
              <th width="10%">Mu</th>
              <th width="10%">Sigma</th>
              <th width="10%">W-L</th>
              <th width="10%">Win %</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    };

    // Navigation
    const nav = document.querySelector(".leaderboard-nav");
    if (nav) {
      nav.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (btn && !btn.disabled) {
          const mode = btn.classList[0];
          if (mode) loadData(mode);
        }
      });
    }
  };

  // Arena Keyboard Navigation
  const initArenaKeyboardNavigation = () => {
    const prevLink = document.querySelector("a.arena-prev");
    const nextLink = document.querySelector("a.arena-next");

    const prevHref = prevLink?.getAttribute("href");
    const nextHref = nextLink?.getAttribute("href");

    if (!prevHref && !nextHref) return;

    document.addEventListener("keydown", (e) => {
      // Ignore if user is typing in an input
      if (e.target.matches("input, textarea, select")) return;

      if (e.key === "ArrowLeft" && prevHref) {
        window.location.href = prevHref;
      } else if (e.key === "ArrowRight" && nextHref) {
        window.location.href = nextHref;
      }
    });
  };

  // Utility: HTML escaping
  const escapeHtml = (str) => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };

  // Initialize all features
  setupFontLoading();
  setupSmoothScroll();
  setupTableSorting();
  initFirearmsFilter();
  initLeaderboards();
  initArenaKeyboardNavigation();
});