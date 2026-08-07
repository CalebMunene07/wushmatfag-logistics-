Drop your hero photo here as `hero.jpg` (or update the <img src="..."> paths
in index.html / track.html / quote.html / about.html / services/*.html if
you'd rather name it something else or use per-page images).

Until an image exists here, the <img> tag hides itself gracefully
(onerror="this.style.display='none'") and you'll just see the Egyptian-blue
gradient background — nothing breaks.

Recommended size: at least 1600x900px, landscape, for a crisp full-bleed
cover across the hero section on all screen sizes.

---

Logo & favicon — drop these files in here with these exact names and they'll
pick up automatically across every page (header nav + footer):

  logo.png              — main logo, used in the header and footer.
                           Recommended: transparent background, ~120–200px
                           wide, roughly 34–40px tall when scaled down.
                           If your logo is dark, note it'll sit on a dark
                           navy background in the footer — a light/white
                           version there looks best (swap the src on the
                           footer <img class="brand-logo-footer"> tag if
                           you want a separate file for that spot).

  favicon.ico            — classic favicon, shown in the browser tab.
  favicon.png            — PNG fallback favicon (any modern square PNG works).
  apple-touch-icon.png   — used when someone adds the site to their iOS
                           home screen. Recommended: 180x180px, no
                           transparency (iOS ignores alpha).

Until these exist, the header/footer gracefully fall back to the "P" mark
and "Paramount" text, and the browser just uses its default favicon —
nothing breaks.

  why-choose.jpg          — photo used in the "Why Choose Paramount?" section
                           on the homepage (operations, team, or facility
                           shot works well). Falls back to a plain blue
                           panel if missing.

