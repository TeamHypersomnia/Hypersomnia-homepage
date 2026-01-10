/* ========================================
   HYPERSOMNIA - Main JavaScript
   ======================================== */

/* Firearms Weapon Filtering */
if (document.querySelector('#firearms')) {
  const weaponCategories = {
    pistols: ["Sn69", "Kek9", "Bulwark", "Calico", "Ao44", "Covert", "Deagle"],
    rifles: ["Galilea", "Hunter", "Baka47", "Datum", "Amplifier arm", "Awka", "BullDup 2000", "Bilmer2000", "Szturm"],
    submachineGuns: ["Szczur", "Zamieć", "Cyberspray", "Pro90"],
    heavyGuns: ["Lews II", "Rocket Launcher ELON"],
    shotguns: ["Gradobicie", "Warx"]
  };

  function toggleAmmoType(type) {
    const fastBtn = document.querySelector('.fastBtn');
    const strongBtn = document.querySelector('.strongBtn');
    const fastElements = document.getElementsByClassName('fast');
    const strongElements = document.getElementsByClassName('strong');

    if (type === 'fast') {
      fastBtn.classList.add('active');
      strongBtn.classList.remove('active');
      
      Array.from(fastElements).forEach(el => el.style.display = 'inline');
      Array.from(strongElements).forEach(el => el.style.display = 'none');
    } else {
      fastBtn.classList.remove('active');
      strongBtn.classList.add('active');
      
      Array.from(fastElements).forEach(el => el.style.display = 'none');
      Array.from(strongElements).forEach(el => el.style.display = 'inline');
    }
  }

  function filterWeapons(category) {
    const rows = document.querySelectorAll('#firearms tbody tr');
    const buttons = document.querySelectorAll('.firearms .btn button');

    rows.forEach(row => {
      const weaponName = row.querySelector('td').innerText.trim();
      const isVisible = category === "all" || weaponCategories[category].includes(weaponName);
      row.style.display = isVisible ? "" : "none";
    });

    buttons.forEach(button => {
      if (button.classList.contains(category)) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  // Event listeners
  const fastBtn = document.querySelector('.fastBtn');
  const strongBtn = document.querySelector('.strongBtn');
  
  if (fastBtn) fastBtn.addEventListener('click', () => toggleAmmoType('fast'));
  if (strongBtn) strongBtn.addEventListener('click', () => toggleAmmoType('strong'));

  document.querySelector('.all')?.addEventListener('click', () => filterWeapons("all"));
  document.querySelector('.pistols')?.addEventListener('click', () => filterWeapons("pistols"));
  document.querySelector('.rifles')?.addEventListener('click', () => filterWeapons("rifles"));
  document.querySelector('.submachineGuns')?.addEventListener('click', () => filterWeapons("submachineGuns"));
  document.querySelector('.heavyGuns')?.addEventListener('click', () => filterWeapons("heavyGuns"));
  document.querySelector('.shotguns')?.addEventListener('click', () => filterWeapons("shotguns"));
}

/* ========================================
   Leaderboards Dynamic Loading
   ======================================== */
if (document.querySelector('#leaderboard')) {
  function leaderboards(mode) {
    const buttons = document.querySelectorAll('.btn button');

    // Reset all buttons
    buttons.forEach(button => {
      button.classList.remove('active');
      button.disabled = true;
      button.dataset.originalText = button.textContent;
    });

    // Activate selected button
    const selectedButton = document.querySelector(`.${mode}`);
    if (selectedButton) {
      selectedButton.classList.add('active');
      selectedButton.disabled = true;
      selectedButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    }

    // Determine URL based on mode
    let url = '';
    if (mode === 'bomb_defusal') {
      url = '/leaderboards/bomb-defusal?format=json';
      history.replaceState({ mode: mode }, '', `/leaderboards/bomb-defusal`);
    } else if (mode === 'ffa') {
      url = '/leaderboards/ffa?format=json';
      history.replaceState({ mode: mode }, '', `/leaderboards/ffa`);
    } else {
      return;
    }

    // Fetch and render leaderboard data
    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        const container = document.querySelector('#leaderboard');
        const placeIcons = ['🏆', '🥈', '🥉'];
        const cdn = 'https://cdn.jsdelivr.net/gh/TeamHypersomnia/Hypersomnia/hypersomnia/content/gfx/necessary/';

        let table = `
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
            <tbody>
        `;

        data.forEach((player, i) => {
          const place = placeIcons[i] || (i + 1);
          const imgSrc = `${cdn}${player.rankImg}`;
          const userLink = `/user/${player.account_id}`;
          const nickname = player.nickname.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const winLoss = player.matches_won - player.matches_lost;
          const totalMatches = player.matches_won + player.matches_lost;
          const winRate = totalMatches === 0 ? '0%' : Math.round((player.matches_won / totalMatches) * 100) + '%';

          table += `
            <tr>
              <td>${place}</td>
              <td><a href="${userLink}"><img class="rank" src="${imgSrc}" alt="">${nickname}</a></td>
              <td>${player.mmr.toFixed(2)}</td>
              <td>${player.mu.toFixed(3)}</td>
              <td>${player.sigma.toFixed(3)}</td>
              <td data-sort="${winLoss}">${player.matches_won}-${player.matches_lost}</td>
              <td>${winRate}</td>
            </tr>
          `;
        });

        table += `</tbody></table>`;
        container.innerHTML = table;

        // Re-enable all buttons
        buttons.forEach(button => {
          button.disabled = false;
          button.textContent = button.dataset.originalText;
        });
        selectedButton.disabled = true;
      })
      .catch(err => {
        console.error('Failed to load leaderboard:', err);
        
        // Show error message
        const container = document.querySelector('#leaderboard');
        container.innerHTML = `
          <div class="alert" style="border-color: rgba(248, 94, 115, 0.3); color: #f85e73; background: linear-gradient(135deg, rgba(248, 94, 115, 0.15), rgba(248, 94, 115, 0.1));">
            <i class="fa-solid fa-triangle-exclamation"></i> Failed to load leaderboard data. Please try again.
          </div>
        `;
        
        // Re-enable all buttons
        buttons.forEach(button => {
          button.disabled = false;
          button.textContent = button.dataset.originalText;
        });
      });
  }

  // Make leaderboards function globally accessible
  window.leaderboards = leaderboards;
}

/* ========================================
   Sortable Table Library
   ======================================== */
document.addEventListener("click", function(c) {
  try {
    function h(b, a) {
      return b.nodeName === a ? b : h(b.parentNode, a);
    }

    var w = c.shiftKey || c.altKey;
    var d = h(c.target, "TH");
    var m = d.parentNode;
    var n = m.parentNode;
    var g = n.parentNode;

    function p(b, a) {
      b.classList.remove("dir-d");
      b.classList.remove("dir-u");
      a && b.classList.add(a);
    }

    function q(b) {
      var a;
      return w ? b.dataset.sortAlt : (a = b.dataset.sort) !== null && a !== void 0 ? a : b.textContent;
    }

    if ("THEAD" === n.nodeName && g.classList.contains("sortable") && !d.classList.contains("no-sort")) {
      var r, f = m.cells;
      var t = parseInt(d.dataset.sortTbr);

      for (c = 0; c < f.length; c++) {
        if (f[c] === d) {
          r = parseInt(d.dataset.sortCol) || c;
        } else {
          p(f[c], "");
        }
      }

      f = "dir-d";
      if (d.classList.contains("dir-d") || g.classList.contains("asc") && !d.classList.contains("dir-u")) {
        f = "dir-u";
      }

      p(d, f);

      var x = "dir-u" === f;
      var y = g.classList.contains("n-last");
      var u = function(b, a, e) {
        a = q(a.cells[e]);
        b = q(b.cells[e]);
        
        if (y) {
          if ("" === a && "" !== b) return -1;
          if ("" === b && "" !== a) return 1;
        }
        
        e = Number(a) - Number(b);
        a = isNaN(e) ? a.localeCompare(b) : e;
        return x ? -a : a;
      };

      for (c = 0; c < g.tBodies.length; c++) {
        var k = g.tBodies[c];
        var v = [].slice.call(k.rows, 0);
        
        v.sort(function(b, a) {
          var e = u(b, a, r);
          return 0 !== e || isNaN(t) ? e : u(b, a, t);
        });

        var l = k.cloneNode();
        l.append.apply(l, v);
        g.replaceChild(l, k);
      }
    }
  } catch (h) {
    console.error('Sortable table error:', h);
  }
});

/* ========================================
   Smooth Scroll Enhancement
   ======================================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ========================================
   Performance Optimizations
   ======================================== */

// Debounce function for scroll events
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Lazy load images if needed
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  });

  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

/* ========================================
   Fade-in Animation on Scroll
   ======================================== */
if ('IntersectionObserver' in window) {
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, {
    threshold: 0.1
  });

  // Add fade-in animation to cards
  document.querySelectorAll('.dl, .sv-row-card, .arenas > a').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    fadeObserver.observe(el);
  });
}

/* ========================================
   Console Easter Egg
   ======================================== */
console.log(
  '%c🎮 HYPERSOMNIA',
  'font-size: 24px; font-weight: bold; color: #00d9ff; text-shadow: 0 0 10px #00d9ff;'
);
console.log(
  '%cFree and Open-Source Multiplayer Shooter',
  'font-size: 14px; color: #8b5cf6;'
);
console.log(
  '%cContribute on GitHub: https://github.com/TeamHypersomnia/Hypersomnia',
  'font-size: 12px; color: #9ca3af;'
);

/* ========================================
   Export functions for global use
   ======================================== */
window.hypersomniaUtils = {
  debounce,
  // Add more utility functions here as needed
};