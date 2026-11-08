/** Small motion helpers. Styles live in assets/css/motion.css. */
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  // The first catalog composition animates in CSS. Once it has played, mark the
  // grid settled so later filter changes keep profile-feed.js's own transitions
  // (re-showing a hidden card would otherwise replay its CSS entrance).
  const settle = (grid) => {
    if (grid.hasAttribute("data-motion-settled")) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      grid.setAttribute("data-motion-settled", "");
    };
    if (reduced.matches) return finish();
    // Safety net: never leave cards waiting on a feed that did not start.
    setTimeout(finish, 4000);
    const root = grid.closest("[data-profile-feed]");
    const play = () => {
      const entrances = grid.getAnimations ? grid.getAnimations({ subtree: true }).filter((a) => a.animationName === "motion-card") : [];
      if (!entrances.length) return finish();
      Promise.allSettled(entrances.map((animation) => animation.finished)).then(finish);
    };
    if (!root || root.dataset.feedReady === "true") return requestAnimationFrame(play);
    const watch = new MutationObserver(() => {
      if (root.dataset.feedReady !== "true") return;
      watch.disconnect();
      requestAnimationFrame(play);
    });
    watch.observe(root, { attributes: true, attributeFilter: ["data-feed-ready"] });
  };

  // A single background pill that slides between category buttons.
  const indicate = (tabs) => {
    if (tabs.hasAttribute("data-indicator")) return;
    const pill = document.createElement("span");
    pill.className = "feed-tabs-indicator";
    pill.setAttribute("aria-hidden", "true");
    tabs.prepend(pill);
    tabs.setAttribute("data-indicator", "");
    const place = () => {
      const active = tabs.querySelector('button[aria-pressed="true"]');
      if (!active || !active.offsetWidth) {
        pill.style.width = "0px";
        return;
      }
      pill.style.translate = `${active.offsetLeft}px ${active.offsetTop}px`;
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.height = `${active.offsetHeight}px`;
    };
    place();
    // Enable transitions only after the first placement so it does not slide in from 0.
    requestAnimationFrame(() => requestAnimationFrame(() => tabs.setAttribute("data-indicator-ready", "")));
    new MutationObserver(place).observe(tabs, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    if ("ResizeObserver" in window) new ResizeObserver(place).observe(tabs);
    document.fonts?.ready.then(place);
  };

  const init = () => {
    document.querySelectorAll(".profile-feed-grid").forEach(settle);
    document.querySelectorAll(".catalog-category-row .feed-tabs").forEach(indicate);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
