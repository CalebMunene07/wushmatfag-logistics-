/* ============================================================================
   HERO + NAV REFRESH — behaviour
   1. Toggles body.hero-nav-scrolled so the floating nav gains its
      egyptian-blue tint once the page scrolls past the hero top.
   2. Drives the hero slideshow: swaps the active photo, and re-triggers the
      typewriter effect on the SAME headline text each time — the copy never
      changes, but it re-types itself in sync with every photo change.
   ============================================================================ */

(function () {
  "use strict";

  /* ---------- 1. Nav scroll colour ---------- */
  const SCROLL_THRESHOLD = 40;
  function onScroll() {
    document.body.classList.toggle(
      "hero-nav-scrolled",
      window.scrollY > SCROLL_THRESHOLD
    );
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 2. Synced slide + typewriter ---------- */
  const slideEls = Array.from(document.querySelectorAll(".hero-slide"));
  const heroCopy = document.querySelector(".hero-copy");
  const heading = document.querySelector(".hero-title");
  const target = heading ? heading.querySelector(".type-target") : null;

  if (!slideEls.length || !heroCopy || !heading || !target) return;

  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Reads the same lines the original hero-typewriter.js used. Falls back
  // to the aria-label, then to whatever text is already in the markup.
  let lines;
  try {
    lines = JSON.parse(heading.dataset.lines || "[]");
  } catch (e) {
    lines = [];
  }
  if (!lines.length) {
    const label = heading.getAttribute("aria-label");
    lines = label ? [label] : [target.textContent.trim()];
  }

  const TYPE_SPEED = 42; // ms per character
  const LINE_BREAK_PAUSE = 4; // multiplier applied after a line break
  const HOLD_DURATION = 6000; // ms the finished text stays on screen
  const SLIDE_FADE = 500; // must match CSS transition on .hero-slide

  function typeIn(done) {
    const tokens = [];
    lines.forEach((line, i) => {
      tokens.push(...line.split(""));
      if (i < lines.length - 1) tokens.push("<br>");
    });

    heading.classList.remove("typing-done");
    let i = 0;
    let output = "";
    target.innerHTML = '<span class="type-cursor"></span>';

    function step() {
      if (i >= tokens.length) {
        heading.classList.add("typing-done");
        if (done) done();
        return;
      }
      output += tokens[i];
      target.innerHTML = output + '<span class="type-cursor"></span>';
      i++;
      const delay =
        tokens[i - 1] === "<br>" ? TYPE_SPEED * LINE_BREAK_PAUSE : TYPE_SPEED;
      setTimeout(step, delay);
    }
    step();
  }

  if (prefersReduced) {
    slideEls[0].classList.add("is-active");
    target.innerHTML = lines.join("<br>");
    heading.classList.add("typing-done");
    return; // static, no rotation
  }

  let current = 0;
  slideEls[0].classList.add("is-active");
  typeIn(scheduleNext);

  function scheduleNext() {
    setTimeout(advance, HOLD_DURATION);
  }

  function advance() {
    heroCopy.classList.add("is-fading");
    const next = (current + 1) % slideEls.length;
    setTimeout(() => {
      slideEls[current].classList.remove("is-active");
      current = next;
      slideEls[current].classList.add("is-active");
      heroCopy.classList.remove("is-fading");
      typeIn(scheduleNext);
    }, SLIDE_FADE);
  }
})();