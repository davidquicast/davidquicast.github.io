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

  // The category marker moves with transforms; its dimensions never tween.
  const indicate = (tabs) => {
    if (tabs.hasAttribute("data-indicator")) return;
    const marker = document.createElement("span");
    marker.className = "feed-tabs-indicator";
    marker.setAttribute("aria-hidden", "true");
    tabs.prepend(marker);
    tabs.setAttribute("data-indicator", "");
    let motion = null;
    let placed = false;
    const place = () => {
      const active = tabs.querySelector('button[aria-pressed="true"]');
      if (!active || !active.offsetWidth) return;
      // Read the interrupted visual geometry before updating the resting layout.
      const before = marker.getBoundingClientRect();
      const target = active.getBoundingClientRect();
      const moved =
        placed &&
        (Math.abs(before.left - target.left) > 0.5 || Math.abs(before.width - target.width) > 0.5 || Math.abs(before.top - target.top) > 0.5);
      motion?.cancel();
      marker.style.translate = `${active.offsetLeft}px ${active.offsetTop}px`;
      marker.style.width = `${active.offsetWidth}px`;
      marker.style.height = `${active.offsetHeight}px`;
      if (moved && !reduced.matches && marker.animate) {
        const animation = marker.animate(
          [
            { transform: `translate(${before.left - target.left}px,${before.top - target.top}px) scaleX(${before.width / target.width})` },
            { transform: "none" },
          ],
          { duration: 220, easing: "cubic-bezier(.2, 0, 0, 1)" }
        );
        motion = animation;
        animation.finished
          .then(() => {
            if (motion === animation) motion = null;
          })
          .catch(() => {});
      }
      placed = true;
      tabs.setAttribute("data-indicator-ready", "");
    };
    place();
    new MutationObserver(place).observe(tabs, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    if ("ResizeObserver" in window) new ResizeObserver(place).observe(tabs);
    document.fonts?.ready.then(place);
    reduced.addEventListener("change", () => {
      if (reduced.matches) motion?.cancel();
    });
  };

  const init = () => {
    document.querySelectorAll(".profile-feed-grid").forEach(settle);
    document.querySelectorAll(".catalog-category-row .feed-tabs").forEach(indicate);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
