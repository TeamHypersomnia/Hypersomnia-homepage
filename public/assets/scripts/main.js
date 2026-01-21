/**
 * HYPERSOMNIA - Main Application Script
 */
document.addEventListener('DOMContentLoaded', function () {

  const CONFIG = {
    interFontUrl: "https://cdn.jsdelivr.net/npm/inter-ui@4.1.0/inter.min.css",
    assetBaseUrl: "https://cdn.gh/TeamHypersomnia/Hypersomnia/hypersomnia/content/gfx/necessary/",
    weaponCategories: {
      pistols: ["Sn69", "Kek9", "Bulwark", "Calico", "Ao44", "Covert", "Deagle"],
      rifles: ["Galilea", "Hunter", "Baka47", "Datum", "Amplifier arm", "Awka", "BullDup 2000", "Bilmer2000", "Szturm"],
      submachineGuns: ["Szczur", "Zamieć", "Cyberspray", "Pro90"],
      heavyGuns: ["Lews II", "Rocket Launcher ELON"],
      shotguns: ["Gradobicie", "Warx"]
    }
  };

  function setupFontLoading() {
    if (window.innerWidth < 768) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CONFIG.interFontUrl;
    document.head.appendChild(link);

    const root = document.documentElement.style;
    root.setProperty("--main-font", "\"Inter\", system-ui, -apple-system, sans-serif");
    root.setProperty("--main-features", "\"cv02\", \"cv03\", \"cv04\", \"cv11\"");
  }

  function setupSmoothScroll() {
    document.addEventListener("click", function (e) {
      const anchor = e.target.closest("a[href^=\"#\"]");
      if (!anchor) return;

      const target = document.querySelector(anchor.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  function setupTableSorting() {
    document.addEventListener("click", function (e) {
      const th = e.target.closest("th");
      const table = th && th.closest("table.sortable");
      if (!table) return;

      const tbody = table.tBodies[0];
      const rows = Array.from(tbody.rows);
      const colIdx = th.cellIndex;
      const isAscending = th.classList.contains("dir-u");

      rows.sort(function (a, b) {
        const aVal = a.cells[colIdx].dataset.sort || a.cells[colIdx].textContent;
        const bVal = b.cells[colIdx].dataset.sort || b.cells[colIdx].textContent;
        return isAscending
          ? bVal.localeCompare(aVal, undefined, { numeric: true })
          : aVal.localeCompare(bVal, undefined, { numeric: true });
      });

      table.querySelectorAll("th").forEach(function (h) {
        h.classList.remove("dir-u", "dir-d");
      });

      th.classList.add(isAscending ? "dir-d" : "dir-u");
      tbody.append.apply(tbody, rows);
    });
  }

  function initFirearmsFilter() {
    const section = document.querySelector("#firearms");
    if (!section) return;

    section.addEventListener("click", function (e) {
      const btn = e.target.closest("button");
      if (!btn) return;

      if (btn.classList.contains("fastBtn") || btn.classList.contains("strongBtn")) {
        const type = btn.classList.contains("fastBtn") ? "fast" : "strong";

        ["fast", "strong"].forEach(function (t) {
          const isActive = t === type;
          const toggleBtn = section.querySelector("." + t + "Btn");
          if (toggleBtn) toggleBtn.classList.toggle("active", isActive);

          section.querySelectorAll("." + t).forEach(function (el) {
            el.style.display = isActive ? "inline" : "none";
          });
        });
        return;
      }

      const category = Array.from(btn.classList).find(function (c) {
        return CONFIG.weaponCategories[c] || c === "all";
      });

      if (category) {
        section.querySelectorAll("tbody tr").forEach(function (row) {
          const name = row.cells[0].innerText.trim();
          const visible = category === "all" || CONFIG.weaponCategories[category].includes(name);
          row.style.display = visible ? "" : "none";
        });

        section.querySelectorAll(".btn button").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
      }
    });
  }

  function initLeaderboards() {
    const container = document.querySelector("#leaderboard");
    if (!container) return;

    async function loadData(mode) {
      const navButtons = document.querySelectorAll(".leaderboard-nav button");
      const activeBtn = document.querySelector("." + mode);

      navButtons.forEach(function (b) {
        b.disabled = true;
        b.dataset.label = b.textContent;
      });

      if (activeBtn) {
        activeBtn.innerHTML = "<i class=\"fa-solid fa-spinner fa-spin\"></i> Loading...";
      }

      try {
        const res = await fetch("/leaderboards/" + mode.replace("_", "-") + "?format=json");
        const data = await res.json();
        history.replaceState({ mode: mode }, "", "/leaderboards/" + mode.replace("_", "-"));
        renderTable(data);
      } catch (err) {
        container.innerHTML = "<div class=\"alert\">Failed to load leaderboard data.</div>";
      } finally {
        navButtons.forEach(function (b) {
          b.disabled = false;
          b.textContent = b.dataset.label;
        });
        if (activeBtn) activeBtn.disabled = true;
      }
    }

    function renderTable(players) {
      const medals = ["🏆", "🥈", "🥉"];
      let rows = "";

      players.forEach(function (p, i) {
        const total = p.matches_won + p.matches_lost;
        const winRate = total === 0 ? "0%" : Math.round((p.matches_won / total) * 100) + "%";

        rows +=
          "<tr>" +
            "<td>" + (medals[i] || (i + 1)) + "</td>" +
            "<td><a href=\"/user/" + p.account_id + "\">" +
              "<img class=\"rank\" src=\"" + CONFIG.assetBaseUrl + p.rankImg + "\">" +
              p.nickname.replace(/</g, "&lt;") +
            "</a></td>" +
            "<td>" + p.mmr.toFixed(2) + "</td>" +
            "<td>" + p.mu.toFixed(3) + "</td>" +
            "<td>" + p.sigma.toFixed(3) + "</td>" +
            "<td data-sort=\"" + (p.matches_won - p.matches_lost) + "\">" +
              p.matches_won + "-" + p.matches_lost +
            "</td>" +
            "<td>" + winRate + "</td>" +
          "</tr>";
      });

      container.innerHTML =
        "<table class=\"sortable maxwidth\"><thead><tr>" +
        "<th class=\"dir-u\" width=\"10%\">#</th>" +
        "<th width=\"40%\">Name</th>" +
        "<th width=\"10%\">MMR</th>" +
        "<th width=\"10%\">Mu</th>" +
        "<th width=\"10%\">Sigma</th>" +
        "<th width=\"10%\">W-L</th>" +
        "<th width=\"10%\">Win %</th>" +
        "</tr></thead><tbody>" + rows + "</tbody></table>";
    }

    const nav = document.querySelector(".leaderboard-nav");
    if (nav) {
      nav.addEventListener("click", function (e) {
        const btn = e.target.closest("button");
        if (btn) loadData(btn.classList[0]);
      });
    }
  }

  function initArenaKeyboardNavigation() {
    const prevLink = document.querySelector("a.arena-prev");
    const nextLink = document.querySelector("a.arena-next");

    const prevHref = prevLink && prevLink.getAttribute("href");
    const nextHref = nextLink && nextLink.getAttribute("href");

    if (!prevHref && !nextHref) return;

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" && prevHref) {
        window.location.href = prevHref;
      }
      if (e.key === "ArrowRight" && nextHref) {
        window.location.href = nextHref;
      }
    });
  }

  setupFontLoading();
  setupSmoothScroll();
  setupTableSorting();
  initFirearmsFilter();
  initLeaderboards();
  initArenaKeyboardNavigation();

});
