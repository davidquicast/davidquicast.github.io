/* Native details disclosure; no hidden links or scroll handlers are synthesized. */
(() => {
  "use strict";
  const sidebar = document.querySelector(".profile-sidebar");
  const root = sidebar?.querySelector("[data-profile-links]");
  const details = root?.querySelector("[data-profile-overflow]");
  if (!root || !details) return;
  const summary = details.querySelector("summary");
  const caption = details.querySelector("[data-profile-toggle-label]");
  const compact = matchMedia("(max-width: 700px), (max-width: 1000px) and (max-height: 520px)");
  let frame = 0;
  let userExpanded = false;
  let previousWidth = 0;
  let labels = {};
  try {
    labels = JSON.parse(document.getElementById("portfolio-ui")?.textContent || "{}").profile || {};
  } catch {}
  const relabel = () => {
    const next = details.open ? labels.fewer_links || "Fewer links" : labels.more_links || "More links";
    if (caption.textContent !== next) caption.textContent = next;
  };
  const measure = () => {
    frame = 0;
    if (!root.isConnected) return;
    let foldable = compact.matches;
    if (!foldable && innerWidth > 1000) {
      // One expanded measurement on mount/resize/fonts/content change, never on scroll.
      root.dataset.profileFoldable = "false";
      details.open = true;
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 72;
      const main = document.querySelector(".site-main");
      const top = main ? parseFloat(getComputedStyle(main).paddingTop) : 40;
      foldable = sidebar.getBoundingClientRect().height > innerHeight - header - top - 24;
    }
    root.dataset.profileFoldable = String(foldable);
    details.open = foldable ? userExpanded : true;
    relabel();
    root.dataset.profileLinksReady = "true";
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };
  summary.addEventListener("click", () => {
    userExpanded = !details.open;
  });
  details.addEventListener("toggle", relabel);
  compact.addEventListener("change", schedule);
  addEventListener("resize", schedule, { passive: true });
  document.fonts?.ready.then(schedule);
  document.fonts?.addEventListener("loadingdone", schedule);
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(([entry]) => {
      if (Math.abs(entry.contentRect.width - previousWidth) < 1) return;
      previousWidth = entry.contentRect.width;
      schedule();
    });
    observer.observe(sidebar);
  }
  const changes = new MutationObserver(schedule);
  changes.observe(root, { childList: true, subtree: true });
  schedule();
})();
