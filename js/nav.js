// Shared behavior across all pages: hamburger toggle, highlight active nav
// link, and swap "Login" <-> "Dashboard/Logout" based on auth state.
document.addEventListener("DOMContentLoaded", async () => {
  // Pages inside a subdirectory (e.g. /services/sea-freight.html) need a
  // "../" prefix on links this script injects dynamically.
  const depth = window.location.pathname.replace(/^\//, "").split("/").length - 1;
  const base = depth > 0 ? "../".repeat(depth) : "";

  // The header is fixed and transparent so the hero's image/overlay shows
  // through it (navbar reads as part of the hero, not a bar on top of it).
  // We measure its real rendered height (differs mobile vs desktop, and
  // whenever the hamburger menu opens/closes) and expose it as --header-h
  // so the hero/page-hero/dash-wrap padding can clear it exactly, then
  // toggle a solid background once the page scrolls past the hero.
  const header = document.querySelector(".site-header");
  if (header) {
    const setHeaderHeightVar = () => {
      document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
    };
    setHeaderHeightVar();
    window.addEventListener("resize", setHeaderHeightVar);

    if (!document.body.classList.contains("no-hero")) {
      const toggleScrolled = () => {
        header.classList.toggle("is-scrolled", window.scrollY > 40);
      };
      toggleScrolled();
      window.addEventListener("scroll", toggleScrolled, { passive: true });
    }
  }

  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("open");
      navLinks.classList.toggle("open");
    });
    navLinks.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        hamburger.classList.remove("open");
        navLinks.classList.remove("open");
      })
    );
  }

  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a[data-page]").forEach((a) => {
    if (a.dataset.page === path) a.classList.add("active");
  });

  const authSlot = document.getElementById("nav-auth-slot");
  if (!authSlot || typeof supabaseClient === "undefined") return;

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (user) {
    authSlot.innerHTML = `
      <a href="${base}dashboard.html" data-page="dashboard.html">Dashboard</a>
      <a href="#" id="logout-link" class="nav-cta">Log out</a>
    `;
    document.getElementById("logout-link").addEventListener("click", async (e) => {
      e.preventDefault();
      await supabaseClient.auth.signOut();
      window.location.href = `${base}index.html`;
    });
  }
});
