/* Native compact reading, with bounded rich-text pages on roomy desktops. */
(() => {
  "use strict";
  const instances = new Map();
  let dictionary = {};
  try {
    dictionary = JSON.parse(document.getElementById("portfolio-ui")?.textContent || "{}");
  } catch {}
  const pageLabel = (current, total) =>
    (dictionary.about_reader?.page || "Page {current} of {total}").replace("{current}", current).replace("{total}", total);
  function mount(scope) {
    const roots = [...scope.querySelectorAll("[data-about-reader]")];
    if (scope.matches?.("[data-about-reader]")) roots.unshift(scope);
    for (const root of roots) {
      if (instances.has(root)) continue;
      const source = root.querySelector("[data-about-source]"),
        view = root.querySelector("[data-about-view]"),
        controls = root.querySelector("[data-about-controls]"),
        status = root.querySelector("[data-about-status]"),
        previous = root.querySelector("[data-about-previous]"),
        next = root.querySelector("[data-about-next]");
      if (!source || !view || !controls || !previous || !next) continue;
      const abort = new AbortController();
      const options = { signal: abort.signal };
      const compact = matchMedia("(max-width: 700px), (max-height: 520px)");
      const originalTabIndex = root.getAttribute("tabindex");
      const restoreTabIndex = () => {
        if (originalTabIndex === null) root.removeAttribute("tabindex");
        else root.setAttribute("tabindex", originalTabIndex);
      };
      let frame = 0,
        pages = [],
        current = 0,
        key = "",
        words = [];
      const fragment = (start, end) => {
        const range = document.createRange(),
          first = words[start],
          last = words[end - 1];
        if (!first || !last) return document.createDocumentFragment();
        range.setStart(first.node, first.start);
        range.setEnd(last.node, last.end);
        const common = range.commonAncestorContainer;
        let result = range.cloneContents();
        let ancestor = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
        // cloneContents omits the common ancestor. Preserve enclosing links,
        // emphasis and paragraph semantics even when a page ends inside them.
        while (ancestor && ancestor !== source) {
          const shell = ancestor.cloneNode(false);
          shell.removeAttribute("id");
          shell.append(result);
          result = shell;
          ancestor = ancestor.parentElement;
        }
        // The hidden canonical source keeps its anchors for no-script/print use.
        // Cloned pages must not introduce duplicate IDs into the same document.
        result.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
        return result;
      };
      const display = () => {
        if (!pages.length) return;
        view.replaceChildren(fragment(pages[current].start, pages[current].end));
        previous.disabled = current === 0;
        next.disabled = current === pages.length - 1;
        status.textContent = pageLabel(current + 1, pages.length);
        root.dataset.aboutCurrentPage = String(current + 1);
        root.dataset.aboutPageCount = String(pages.length);
      };
      const compose = () => {
        frame = 0;
        if (!root.isConnected) return;
        if (compact.matches) {
          if (root.dataset.aboutMode !== "scroll") {
            root.dataset.aboutMode = "scroll";
            delete root.dataset.aboutEnhanced;
            delete root.dataset.aboutCurrentPage;
            delete root.dataset.aboutPageCount;
            source.hidden = false;
            view.hidden = true;
            view.replaceChildren();
            controls.hidden = true;
            // The native overlay scrolls its body; focus within that region lets
            // keyboard users use PageDown/Home/End without a custom key handler.
            if (root.closest("[data-overlay-body]")) root.tabIndex = 0;
            key = "";
          }
          root.dataset.aboutReady = "true";
          return;
        }
        if (root.dataset.aboutMode !== "paged") {
          root.dataset.aboutMode = "paged";
          root.dataset.aboutEnhanced = "true";
          source.hidden = true;
          view.hidden = false;
          controls.hidden = true;
          restoreTabIndex();
          key = "";
        }
        const width = view.clientWidth,
          height = view.clientHeight;
        if (width < 1 || height < 1) return;
        const font = getComputedStyle(view);
        const signature = [width, height, font.font, font.lineHeight, font.columnCount, font.columnGap, source.innerHTML].join("|");
        if (signature === key) return;
        key = signature;
        const remembered = pages[current]?.start || 0;
        words = [];
        const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (const match of node.textContent.matchAll(/\S+\s*/gu)) words.push({ node, start: match.index, end: match.index + match[0].length });
        }
        const built = [];
        let start = 0;
        // Bound each search by remaining words; measurements happen only on mount/resize/font/content changes.
        while (start < words.length) {
          let low = start + 1,
            high = words.length,
            best = low;
          while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            view.replaceChildren(fragment(start, middle));
            if (view.scrollHeight <= view.clientHeight + 1 && view.scrollWidth <= view.clientWidth + 1) {
              best = middle;
              low = middle + 1;
            } else high = middle - 1;
          }
          // Keep a section heading with its paragraph whenever the reading area permits.
          // This does not alter source order, and still makes progress in very short windows.
          const endingHeading = words[best - 1]?.node.parentElement?.closest("h2");
          if (endingHeading && best < words.length) {
            let headingStart = best - 1;
            while (headingStart > start && endingHeading.contains(words[headingStart - 1].node)) headingStart--;
            if (headingStart > start) best = headingStart;
          }
          built.push({ start, end: best });
          start = best;
        }
        pages = built;
        current = Math.max(
          0,
          pages.findIndex((p) => p.start <= remembered && p.end > remembered)
        );
        display();
        controls.hidden = false;
        root.dataset.aboutReady = "true";
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(compose);
      };
      // The semantic source stays visible until a desktop composition is ready.
      controls.hidden = true;
      compact.addEventListener("change", schedule, options);
      previous.addEventListener(
        "click",
        () => {
          if (current > 0) {
            current--;
            display();
          }
        },
        options
      );
      next.addEventListener(
        "click",
        () => {
          if (current < pages.length - 1) {
            current++;
            display();
          }
        },
        options
      );
      root.addEventListener(
        "keydown",
        (event) => {
          if (root.dataset.aboutMode !== "paged" || event.target.closest("a,input,select,textarea")) return;
          if (event.key === "ArrowRight" && !next.disabled) {
            event.preventDefault();
            current++;
            display();
          } else if (event.key === "ArrowLeft" && !previous.disabled) {
            event.preventDefault();
            current--;
            display();
          }
        },
        options
      );
      const resize = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
      resize?.observe(view);
      if (!resize) addEventListener("resize", schedule, options);
      const mutations = new MutationObserver(schedule);
      mutations.observe(source, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style", "class"] });
      mutations.observe(view, { attributes: true, attributeFilter: ["style", "class"] });
      document.fonts?.addEventListener(
        "loadingdone",
        () => {
          key = "";
          schedule();
        },
        options
      );
      document.fonts?.ready.then(schedule);
      instances.set(root, () => {
        abort.abort();
        resize?.disconnect();
        mutations.disconnect();
        cancelAnimationFrame(frame);
        restoreTabIndex();
        instances.delete(root);
      });
      schedule();
    }
  }
  mount(document);
  document.addEventListener("portfolio:content-mounted", (event) => {
    if (event.detail?.scope) mount(event.detail.scope);
  });
  document.addEventListener("portfolio:content-unmounted", (event) => {
    const scope = event.detail?.scope;
    if (!(scope instanceof Element)) return;
    for (const [root, dispose] of instances) if (root === scope || scope.contains(root)) dispose();
  });
})();
