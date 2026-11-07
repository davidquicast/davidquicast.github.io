/* Idempotent semantic content enhancements for pages and fetched detail scopes. */
(() => {
  "use strict";
  const installation = Symbol.for("portfolio.contentEnhancements");
  if (window[installation]) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const bindings = new WeakMap();
  const ui = (() => {
    try {
      return JSON.parse(document.getElementById("portfolio-ui")?.textContent || "{}");
    } catch {
      return {};
    }
  })();
  const label = (path, fallback, values = {}) => {
    const value = path.split(".").reduce((node, key) => (node && typeof node === "object" ? node[key] : undefined), ui);
    return (typeof value === "string" && value ? value : fallback).replace(/\{(\w+)\}/g, (match, key) =>
      Object.hasOwn(values, key) ? String(values[key]) : match
    );
  };
  const nodes = (scope, selector) => [...(scope.matches?.(selector) ? [scope] : []), ...scope.querySelectorAll(selector)];
  const sourceURL = (context) => {
    try {
      return new URL(context.url || location.href, location.href);
    } catch {
      return new URL(location.href);
    }
  };
  const bind = (node, type, setup) => {
    let features = bindings.get(node);
    if (!features) {
      features = new Map();
      bindings.set(node, features);
    }
    if (features.has(type)) return;
    const controller = new AbortController();
    const cleanups = [];
    const record = {
      signal: controller.signal,
      cleanup: () => {
        if (controller.signal.aborted) return;
        controller.abort();
        cleanups.reverse().forEach((cleanup) => cleanup());
        features.delete(type);
        if (!features.size) bindings.delete(node);
      },
      own: (cleanup) => cleanups.push(cleanup),
    };
    features.set(type, record);
    try {
      setup(record);
    } catch (error) {
      record.cleanup();
      throw error;
    }
  };
  const listen = (record, target, name, callback, options = {}) => target.addEventListener(name, callback, { ...options, signal: record.signal });
  const enableControls = (root, record) => {
    nodes(root, "[data-ui]").forEach((element) => {
      const previous = element.getAttribute("data-enhanced");
      element.dataset.enhanced = "true";
      record.own(() => (previous === null ? element.removeAttribute("data-enhanced") : element.setAttribute("data-enhanced", previous)));
    });
    root.querySelectorAll("[data-enable-with-js]").forEach((control) => {
      const previous = control.disabled;
      control.disabled = false;
      record.own(() => {
        control.disabled = previous;
      });
    });
  };
  const filter = (root, context) =>
    bind(root, "filter", (record) => {
      const input = root.querySelector("[data-search]");
      const buttons = [...root.querySelectorAll("[data-filter]")];
      const year = root.querySelector("[data-year]");
      const projectTopic = root.querySelector("[data-project-topic]");
      const items = [...root.querySelectorAll("[data-filter-item]")];
      const empty = root.querySelector("[data-empty]");
      const status = root.querySelector("[data-status]");
      if (!input || !empty || !status) {
        record.cleanup();
        return;
      }
      let active = "all";
      const readUrl = () => {
        const params = sourceURL(context).searchParams;
        active = buttons.some((button) => button.dataset.filter === params.get("topic")) ? params.get("topic") : "all";
        if (projectTopic) {
          const legacyGroup = { personal: "independent", collaborations: "contributions" }[params.get("topic")];
          const selectedGroup = params.get("project") || legacyGroup;
          active = buttons.some((button) => button.dataset.filter === selectedGroup) ? selectedGroup : "all";
          projectTopic.value = [...projectTopic.options].some((option) => option.value === params.get("topic")) ? params.get("topic") : "all";
        }
        input.value = params.get("q") || "";
        if (year) year.value = [...year.options].some((option) => option.value === params.get("year")) ? params.get("year") : "all";
      };
      const normalize = (value) =>
        String(value || "")
          .toLocaleLowerCase(document.documentElement.lang || "en")
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "");
      const apply = (writeUrl = true) => {
        const query = normalize(input.value.trim());
        let count = 0;
        items.forEach((item) => {
          const topics = (item.dataset.topics || "").split(/\s+/);
          item.hidden = !(
            (active === "all" || topics.includes(active)) &&
            (!projectTopic || projectTopic.value === "all" || topics.includes(projectTopic.value)) &&
            (!year || year.value === "all" || year.value === item.dataset.year) &&
            (!query || normalize(item.dataset.searchText + " " + item.dataset.topics).includes(query))
          );
          if (!item.hidden) count++;
        });
        buttons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === active)));
        empty.hidden = count !== 0;
        const kind = root.dataset.kind === "projects" ? "project" : "article";
        status.textContent = label(`filters.${kind}_${count === 1 ? "singular" : "plural"}`, `{count} ${kind}${count === 1 ? "" : "s"}`, { count });
        // The overlay owns its history. Local content controls never rewrite its
        // profile URL; the ordinary static collection retains its existing URLs.
        if (writeUrl && !context.dynamic) {
          const next = new URL(location.href);
          [
            ["q", input.value.trim()],
            ["topic", projectTopic ? (projectTopic.value === "all" ? "" : projectTopic.value) : active === "all" ? "" : active],
            ...(projectTopic ? [["project", active === "all" ? "" : active]] : []),
            ["year", year && year.value !== "all" ? year.value : ""],
          ].forEach(([key, value]) => (value ? next.searchParams.set(key, value) : next.searchParams.delete(key)));
          history.replaceState(history.state, "", next);
        }
        document.dispatchEvent(new Event("portfolio:filter"));
      };
      readUrl();
      buttons.forEach((button) =>
        listen(record, button, "click", () => {
          active = button.dataset.filter;
          apply();
        })
      );
      listen(record, input, "input", () => apply());
      if (year) listen(record, year, "change", () => apply());
      if (projectTopic) listen(record, projectTopic, "change", () => apply());
      const reset = root.querySelector("[data-reset]");
      if (reset)
        listen(record, reset, "click", () => {
          input.value = "";
          active = "all";
          if (year) year.value = "all";
          if (projectTopic) projectTopic.value = "all";
          apply();
          input.focus();
        });
      if (!context.dynamic)
        listen(record, window, "popstate", () => {
          readUrl();
          apply(false);
        });
      apply(false);
      enableControls(root, record);
    });
  const outline = (article, context) =>
    bind(article, "outline", (record) => {
      const content = article.querySelector(".article-content, #markdown-content");
      const toc = article.querySelector("#article-toc");
      if (!content || !toc) {
        record.cleanup();
        return;
      }
      const disclosure = toc.closest("details");
      if (disclosure) {
        const previous = { open: disclosure.open, hidden: disclosure.hidden };
        const wide = matchMedia("(min-width: 768px)");
        disclosure.open = wide.matches;
        listen(record, wide, "change", () => {
          disclosure.open = wide.matches;
        });
        record.own(() => {
          disclosure.open = previous.open;
          disclosure.hidden = previous.hidden;
        });
      }
      const headings = [...content.querySelectorAll("h2")];
      if (headings.length < 2) {
        if (disclosure) disclosure.hidden = true;
        return;
      }
      if (disclosure) disclosure.hidden = false;
      const ids = new Set([...article.querySelectorAll("[id]")].map((item) => item.id));
      const links = new Map();
      const generated = [];
      headings.forEach((heading, index) => {
        if (!heading.id) {
          const base =
            heading.textContent
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "section";
          let id = base,
            suffix = index + 1;
          while (ids.has(id)) id = base + "-" + suffix++;
          heading.id = id;
          ids.add(id);
        }
        const link = document.createElement("a");
        link.href = "#" + heading.id;
        link.textContent = heading.textContent;
        toc.append(link);
        generated.push(link);
        links.set(heading.id, link);
      });
      record.own(() => generated.forEach((link) => link.remove()));
      const scrollContainer = context.scrollContainer || article.closest("[data-content-scroll]");
      if (context.dynamic && scrollContainer instanceof HTMLElement) {
        listen(record, toc, "click", (event) => {
          const link = event.target.closest?.('a[href^="#"]');
          if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
          const target = headings.find((heading) => "#" + heading.id === link.getAttribute("href"));
          if (!target) return;
          event.preventDefault();
          const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
          const top =
            target.getBoundingClientRect().top -
            scrollContainer.getBoundingClientRect().top +
            scrollContainer.scrollTop -
            scrollContainer.clientTop -
            margin;
          scrollContainer.scrollTo({ top, behavior: reduced.matches ? "instant" : "smooth" });
          links.forEach((item, id) => (id === target.id ? item.setAttribute("aria-current", "location") : item.removeAttribute("aria-current")));
        });
      }
      // Pixel-based bounds avoid IntersectionObserver percentage margins resolving
      // against a wide overlay's width rather than its short scroll viewport.
      let activeFrame = 0;
      const scrollRoot = context.dynamic && scrollContainer instanceof HTMLElement ? scrollContainer : window;
      const updateActive = () => {
        activeFrame = 0;
        const bounds = scrollRoot === window ? { top: 0, height: innerHeight } : scrollRoot.getBoundingClientRect();
        const boundary = bounds.top + bounds.height * 0.2;
        const positions = headings.map((heading) => ({ heading, top: heading.getBoundingClientRect().top }));
        let current = positions[0].heading;
        positions.forEach(({ heading, top }) => {
          if (top <= boundary) current = heading;
        });
        const scrollTop = scrollRoot === window ? scrollY : scrollRoot.scrollTop;
        const maximum =
          scrollRoot === window ? document.documentElement.scrollHeight - innerHeight : scrollRoot.scrollHeight - scrollRoot.clientHeight;
        if (maximum > 0 && maximum - scrollTop <= 2) current = headings.at(-1);
        links.forEach((link, id) => (id === current.id ? link.setAttribute("aria-current", "location") : link.removeAttribute("aria-current")));
      };
      const scheduleActive = () => {
        if (!activeFrame && !record.signal.aborted) activeFrame = requestAnimationFrame(updateActive);
      };
      listen(record, scrollRoot, "scroll", scheduleActive, { passive: true });
      listen(record, window, "resize", scheduleActive, { passive: true });
      listen(record, document, "portfolio:content-updated", scheduleActive);
      if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(scheduleActive);
        observer.observe(content);
        if (scrollRoot !== window) observer.observe(scrollRoot);
        record.own(() => observer.disconnect());
      }
      record.own(() => {
        if (activeFrame) cancelAnimationFrame(activeFrame);
      });
      document.fonts?.ready.then(scheduleActive);
      scheduleActive();
    });
  const copyCode = (pre) =>
    bind(pre, "copy", (record) => {
      const previousTabIndex = pre.getAttribute("tabindex");
      pre.tabIndex = 0;
      const existingFrame = pre.parentElement?.classList.contains("code-frame");
      const frame = existingFrame ? pre.parentElement : document.createElement("div");
      if (!existingFrame) {
        frame.className = "code-frame";
        pre.before(frame);
        frame.append(pre);
      }
      const existingButton = [...frame.children].find((element) => element.matches("button.copy-code"));
      const button = existingButton || document.createElement("button");
      button.type = "button";
      button.className = "copy-code";
      button.textContent = label("clipboard.copy", "Copy code");
      button.setAttribute("aria-label", label("clipboard.copy", "Copy code"));
      button.setAttribute("aria-live", "polite");
      if (!existingButton) frame.append(button);
      listen(record, button, "click", async () => {
        try {
          await navigator.clipboard.writeText(pre.textContent);
          if (record.signal.aborted) return;
          button.textContent = label("clipboard.copied", "Copied");
          button.setAttribute("aria-label", label("clipboard.copied", "Code copied"));
        } catch {
          if (record.signal.aborted) return;
          button.textContent = label("clipboard.error", "Select to copy");
          button.setAttribute("aria-label", label("clipboard.error", "Select and copy the code manually"));
        }
      });
      record.own(() => {
        if (!existingButton) button.remove();
        if (!existingFrame && frame.parentNode) frame.replaceWith(...frame.childNodes);
        if (previousTabIndex === null) pre.removeAttribute("tabindex");
        else pre.setAttribute("tabindex", previousTabIndex);
      });
    });
  const profileAnchors = (nav, scope, context) =>
    bind(nav, "profile", (record) => {
      const sections = [...nav.querySelectorAll('a[href^="#"]')]
        .map((link) => ({ link, section: nodes(scope, "[id]").find((node) => "#" + node.id === link.getAttribute("href")) }))
        .filter((entry) => entry.section);
      if (!sections.length) {
        record.cleanup();
        return;
      }
      const mark = (id) =>
        sections.forEach(({ link, section }) =>
          section.id === id ? link.setAttribute("aria-current", "location") : link.removeAttribute("aria-current")
        );
      const initial = sections.find(({ section }) => "#" + section.id === sourceURL(context).hash) || sections[0];
      mark(initial.section.id);
      let frame = 0;
      const scrollRoot = context.scrollContainer || window;
      const update = () => {
        frame = 0;
        const bounds = scrollRoot === window ? { top: 0, height: innerHeight } : scrollRoot.getBoundingClientRect();
        const boundary = bounds.top + Math.max(100, bounds.height * 0.25);
        let current = sections[0];
        sections.forEach((entry) => {
          if (entry.section.getBoundingClientRect().top <= boundary) current = entry;
        });
        if (scrollRoot === window && scrollY > 0 && document.documentElement.scrollHeight - scrollY - innerHeight <= 2) current = sections.at(-1);
        mark(current.section.id);
      };
      const schedule = () => {
        if (!frame && !record.signal.aborted) frame = requestAnimationFrame(update);
      };
      listen(record, scrollRoot, "scroll", schedule, { passive: true });
      listen(record, window, "resize", schedule, { passive: true });
      listen(record, document, "portfolio:content-updated", schedule);
      if (!context.dynamic)
        listen(record, window, "hashchange", () => {
          const match = sections.find(({ section }) => "#" + section.id === location.hash);
          if (match) mark(match.section.id);
          else if (!location.hash || location.hash === "#main") mark(sections[0].section.id);
        });
      record.own(() => {
        if (frame) cancelAnimationFrame(frame);
      });
      document.fonts?.ready.then(schedule);
      schedule();
    });
  const revealObserver =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                revealObserver.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.1 }
        )
      : null;
  const reveal = (node) =>
    bind(node, "reveal", (record) => {
      if (reduced.matches || !revealObserver) node.classList.add("is-visible");
      else revealObserver.observe(node);
      record.own(() => revealObserver?.unobserve(node));
    });
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    revealObserver?.disconnect();
    document.querySelectorAll("[data-reveal]").forEach((node) => node.classList.add("is-visible"));
  });
  const enhance = (scope = document, context = {}) => {
    if (!scope?.querySelectorAll) return;
    const options = { ...context, dynamic: scope !== document };
    const localContext = (node) => {
      const scrollContainer = options.scrollContainer || node.closest?.("[data-content-scroll]");
      return scrollContainer ? { ...options, dynamic: true, scrollContainer } : options;
    };
    nodes(scope, "[data-filter-root]").forEach((node) => filter(node, localContext(node)));
    nodes(scope, ".editorial-post").forEach((node) => outline(node, localContext(node)));
    nodes(scope, ".article-content pre, #markdown-content pre, .research-citation pre, .paper-detail pre, .general-page .prose pre").forEach(
      copyCode
    );
    nodes(scope, ".profile-tabs").forEach((node) => profileAnchors(node, scope, localContext(node)));
    nodes(scope, "[data-reveal]").forEach(reveal);
    document.dispatchEvent(new CustomEvent("portfolio:content-updated", { detail: { scope } }));
  };
  const unmount = (scope) => {
    if (!scope?.querySelectorAll) return;
    nodes(scope, "*").forEach((node) => {
      const features = bindings.get(node);
      if (features) [...features.values()].forEach((record) => record.cleanup());
    });
  };
  window[installation] = Object.freeze({ enhance, unmount });
  document.addEventListener("portfolio:content-mounted", (event) => enhance(event.detail?.scope, event.detail || {}));
  document.addEventListener("portfolio:content-unmounted", (event) => unmount(event.detail?.scope));
  enhance(document);
})();
