/*
  Main nav buttons drawn like the in-game menu buttons of Hypersomnia (cyan theme).
  Geometry reproduces button_with_corners (lower_side 12, upper_side 8, inside_border_padding 4)
  drawn with a horizontal flip, as in option_button::draw. Units below are game pixels;
  --mb-scale says how many CSS px one game pixel takes.
*/
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";

  const SIDE_L = 8, SIDE_T = 8, SIDE_R = 12, SIDE_B = 12;
  const MARGIN = 12; /* room around the button for the hover/push effect */

  const HOVER_MAX_DISTANCE = 8;
  const HOVER_DURATION_MS = 400;
  const PUSH_DISTANCE = 4;

  const INSIDE_ALPHA = { idle: 20, hover: 30, pushed: 60 };
  const BORDER_ALPHA = { idle: 190, hover: 220, pushed: 255 };

  const SOUND_VOLUME = 0.35;
  const sounds = {
    hover: new Audio("/assets/sfx/button_hover.wav"),
    click: new Audio("/assets/sfx/button_click.wav"),
  };

  function play(name) {
    const a = sounds[name].cloneNode();
    a.volume = SOUND_VOLUME;
    a.play().catch(() => {});
  }

  /* (l, t, r, b) is the internal rect; coordinates are pixel centers */

  function outline(l, t, r, b) {
    return `M${l - 7.5} ${t - 0.5}L${l - 0.5} ${t - 7.5}L${r + 11.5} ${t - 7.5}L${r + 11.5} ${b + 0.5}` +
      `L${r + 0.5} ${b + 11.5}L${l - 7.5} ${b + 11.5}Z`;
  }

  function internalBorders(l, t, r, b) {
    return `M${l - 0.5} ${t - 3.5}L${l - 3.5} ${t - 0.5}` +
      `M${r + 0.5} ${t - 3.5}L${r + 7.5} ${t - 3.5}L${r + 7.5} ${t - 0.5}` +
      `M${r + 7.5} ${b + 0.5}L${r + 0.5} ${b + 7.5}` +
      `M${l - 3.5} ${b + 0.5}L${l - 3.5} ${b + 7.5}L${l - 0.5} ${b + 7.5}`;
  }

  /* only the corner pieces of the outer border */
  function cornerBorders(l, t, r, b) {
    return `M${l - 7.5} ${t - 0.5}L${l - 0.5} ${t - 7.5}` +
      `M${r + 0.5} ${t - 7.5}L${r + 11.5} ${t - 7.5}L${r + 11.5} ${t - 0.5}` +
      `M${r + 11.5} ${b + 0.5}L${r + 0.5} ${b + 11.5}` +
      `M${l - 0.5} ${b + 11.5}L${l - 7.5} ${b + 11.5}L${l - 7.5} ${b + 0.5}`;
  }

  function el(name, attrs) {
    const e = document.createElementNS(SVG_NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  const animating = new Set();
  let rafPending = false;

  function tick() {
    rafPending = false;
    const now = performance.now();

    for (const btn of animating) {
      btn.draw(now);
      if (!btn.isAnimating(now)) animating.delete(btn);
    }

    if (animating.size) requestAnimate();
  }

  function requestAnimate() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(tick);
    }
  }

  /* cornersOnly: no frame at all, just the four hover corners around the
     whole element (used for the logo) */
  function makeButton(a, cornersOnly) {
    /* where the internal rect starts inside the element */
    const IN_L = cornersOnly ? 0 : SIDE_L, IN_T = cornersOnly ? 0 : SIDE_T;
    const IN_R = cornersOnly ? 0 : SIDE_R, IN_B = cornersOnly ? 0 : SIDE_B;

    const svg = el("svg", { class: "menu-btn-frame", "aria-hidden": "true", "shape-rendering": "crispEdges" });
    const inside = el("path", { class: "menu-btn-inside" });
    const border = el("path", { class: "menu-btn-border" });
    const effect = el("path", { class: "menu-btn-effect" });
    svg.append(inside, border, effect);
    a.prepend(svg);

    const btn = {
      hovered: false,
      pushed: false,
      hoverStart: 0,
      W: 0,
      H: 0,

      layout() {
        const s = parseFloat(getComputedStyle(a).getPropertyValue("--mb-scale")) || 1;
        const bw = Math.round(a.offsetWidth / s);
        const bh = Math.round(a.offsetHeight / s);

        btn.W = bw - IN_L - IN_R;
        btn.H = bh - IN_T - IN_B;

        /* the svg always has room for the corners outside the internal rect */
        const vw = btn.W + SIDE_L + SIDE_R + 2 * MARGIN, vh = btn.H + SIDE_T + SIDE_B + 2 * MARGIN;
        svg.setAttribute("viewBox", `${-SIDE_L - MARGIN} ${-SIDE_T - MARGIN} ${vw} ${vh}`);
        svg.style.left = `${(IN_L - SIDE_L - MARGIN) * s}px`;
        svg.style.top = `${(IN_T - SIDE_T - MARGIN) * s}px`;
        svg.style.width = `${vw * s}px`;
        svg.style.height = `${vh * s}px`;

        btn.draw(performance.now());
      },

      hoverDistance(now) {
        const elapsed = Math.min(HOVER_DURATION_MS, now - btn.hoverStart);
        return (1 - elapsed / HOVER_DURATION_MS) * HOVER_MAX_DISTANCE;
      },

      isAnimating(now) {
        return btn.hovered && !btn.pushed && now - btn.hoverStart < HOVER_DURATION_MS;
      },

      draw(now) {
        const { W, H } = btn;
        /* the current page's button looks like it is held down */
        const pushed = btn.pushed || a.classList.contains("active");
        const state = pushed ? "pushed" : btn.hovered ? "hover" : "idle";

        if (cornersOnly) {
          /* pushed pulls the corners in tight, hover slides them in */
          const e = btn.pushed ? -PUSH_DISTANCE / 2 : btn.hovered ? btn.hoverDistance(now) : null;
          effect.setAttribute("d", e === null ? "" : cornerBorders(-e, -e, W + e, H + e));
          return;
        }

        inside.setAttribute("d", outline(0, 0, W, H));
        border.setAttribute("d", outline(0, 0, W, H) + internalBorders(0, 0, W, H));
        svg.style.setProperty("--inside-a", INSIDE_ALPHA[state] / 255);
        svg.style.setProperty("--border-a", BORDER_ALPHA[state] / 255);

        if (pushed) {
          const e = PUSH_DISTANCE;
          effect.setAttribute("d", outline(-e, -e, W + e, H + e) + internalBorders(-e, -e, W + e, H + e));
        }
        else if (btn.hovered) {
          const e = btn.hoverDistance(now);
          effect.setAttribute("d", cornerBorders(-e, -e, W + e, H + e) + internalBorders(-e, -e, W + e, H + e));
        }
        else {
          effect.setAttribute("d", "");
        }
      },

      setHovered(h) {
        if (btn.hovered === h) return;
        btn.hovered = h;

        if (h) {
          btn.hoverStart = performance.now();
          play("hover");
          animating.add(btn);
          requestAnimate();
        }
        else {
          btn.pushed = false;
        }

        btn.draw(performance.now());
      },

      setPushed(p) {
        btn.pushed = p;
        /* like in the game, releasing leaves the corners fully settled */
        if (!p) btn.hoverStart = performance.now() - HOVER_DURATION_MS;
        btn.draw(performance.now());
      },
    };

    a.addEventListener("pointerenter", () => btn.setHovered(true));
    a.addEventListener("pointerleave", () => btn.setHovered(false));
    a.addEventListener("focus", () => btn.setHovered(true));
    a.addEventListener("blur", () => btn.setHovered(false));
    a.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      play("click");
      btn.setPushed(true);
    });
    a.addEventListener("pointerup", () => btn.setPushed(false));
    a.addEventListener("pointercancel", () => btn.setPushed(false));

    /* coming back with the back button must not leave a stale pushed/hover state */
    window.addEventListener("pageshow", () => {
      btn.pushed = false;
      btn.setHovered(a.matches(":hover"));
    });

    return btn;
  }

  function init() {
    const anchors = [...document.querySelectorAll("a.menu-btn, a.menu-btn-corners")];
    const buttons = anchors.map(a => makeButton(a, a.classList.contains("menu-btn-corners")));
    const relayout = () => buttons.forEach(b => b.layout());

    relayout();
    const observer = new ResizeObserver(relayout);
    anchors.forEach(a => observer.observe(a));
    document.fonts?.ready.then(relayout);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  }
  else {
    init();
  }
})();
