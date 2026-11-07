(() => {
  "use strict";
  const cards = [...document.querySelectorAll("[data-wall-card]")].filter((card) => !card.closest("[data-profile-feed]"));
  if (!cards.length || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-entered", "");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.06 }
  );
  cards.forEach((card) => observer.observe(card));
})();
