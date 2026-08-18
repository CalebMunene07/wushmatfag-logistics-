// Animate number counters and progress bars on scroll into view
const observerOptions = {
  threshold: 0.3,
  rootMargin: "0px 0px -50px 0px"
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounters(entry.target);
      animateProgressBars(entry.target);
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe all stat values and progress items
document.querySelectorAll(".stats-band-value, .progress-item").forEach(el => {
  observer.observe(el);
});

function animateCounters(container) {
  container.querySelectorAll("[data-counter]").forEach(el => {
    const target = parseInt(el.getAttribute("data-counter"), 10);
    const suffix = el.getAttribute("data-suffix") || "";
    const duration = 1400; // milliseconds
    const start = Date.now();
    const startValue = 0;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - start) / duration, 1);
      const current = Math.floor(startValue + (target - startValue) * easeOutQuad(progress));
      el.textContent = current + suffix;

      if (progress < 1) requestAnimationFrame(animate);
    };

    animate();
  });
}

function animateProgressBars(container) {
  container.querySelectorAll(".progress-fill").forEach(fill => {
    const fillPercent = parseInt(fill.getAttribute("data-fill"), 10);
    const duration = 1400;
    const start = Date.now();

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - start) / duration, 1);
      const current = fillPercent * easeOutQuad(progress);
      fill.style.width = current + "%";

      if (progress < 1) requestAnimationFrame(animate);
    };

    animate();

    // Also update the percentage text
    const valueEl = fill.closest(".progress-item").querySelector(".progress-value");
    if (valueEl) {
      const target = parseInt(valueEl.getAttribute("data-target"), 10);
      const start = Date.now();

      const animateValue = () => {
        const now = Date.now();
        const progress = Math.min((now - start) / duration, 1);
        const current = Math.floor(target * easeOutQuad(progress));
        valueEl.textContent = current + "%";

        if (progress < 1) requestAnimationFrame(animateValue);
      };

      animateValue();
    }
  });
}

// Easing function for smooth animation
function easeOutQuad(t) {
  return t * (2 - t);
}