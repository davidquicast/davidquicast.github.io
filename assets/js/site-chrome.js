/* Optional page chrome. Fetched overlays keep their own independent scrolling. */
(() => {
  "use strict";
  const installation = Symbol.for("portfolio.siteChrome");
  if (window[installation]) return;
  window[installation] = true;
  const script = document.currentScript;
  const root = document.documentElement;
  const footer = document.querySelector("[data-site-footer]");
  if (script?.dataset.fixedFooter === "true" && footer) {
    const reserveFooter = () => {
      root.style.setProperty("--fixed-footer-height", `${Math.ceil(footer.getBoundingClientRect().height)}px`);
      document.body.classList.add("fixed-footer-ready");
    };
    reserveFooter();
    if ("ResizeObserver" in window) new ResizeObserver(reserveFooter).observe(footer);
    else window.addEventListener("resize", reserveFooter, { passive: true });
  }
  const progress = document.querySelector("div[data-reading-progress]");
  const fill = progress?.querySelector(".site-progress-fill");
  // Never select an article injected into an overlay on a profile page.
  const article = document.querySelector("main#main .editorial-post");
  const content = article?.querySelector(".article-content");
  if (script?.dataset.readingProgress !== "true" || !fill || !article || !content) return;
  const controller = new AbortController();
  const options = { passive: true, signal: controller.signal };
  let start = 0;
  let distance = 1;
  let frame = 0;
  let measurePending = true;
  let observer = null;
  const stop = () => {
    controller.abort();
    observer?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    progress.hidden = true;
  };
  const update = () => {
    frame = 0;
    if (!article.isConnected || !content.isConnected) {
      stop();
      return;
    }
    if (measurePending) {
      const y = window.scrollY;
      start = article.getBoundingClientRect().top + y;
      distance = Math.max(1, content.getBoundingClientRect().bottom + y - window.innerHeight - start);
      measurePending = false;
    }
    const amount = Math.min(1, Math.max(0, (window.scrollY - start) / distance));
    fill.style.transform = `scaleX(${amount})`;
    progress.hidden = false;
  };
  const schedule = () => {
    if (!controller.signal.aborted && !frame && !document.hidden) frame = requestAnimationFrame(update);
  };
  const remeasure = () => {
    measurePending = true;
    schedule();
  };
  window.addEventListener("scroll", schedule, options);
  window.addEventListener("resize", remeasure, options);
  window.addEventListener("pageshow", remeasure, { signal: controller.signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else schedule();
    },
    { signal: controller.signal }
  );
  document.addEventListener(
    "portfolio:content-unmounted",
    (event) => {
      const scope = event.detail?.scope;
      if (scope === article || scope?.contains?.(article)) stop();
    },
    { signal: controller.signal }
  );
  if ("ResizeObserver" in window) {
    observer = new ResizeObserver(remeasure);
    observer.observe(article);
    observer.observe(content);
  }
  document.fonts?.ready.then(remeasure);
  remeasure();
})();
