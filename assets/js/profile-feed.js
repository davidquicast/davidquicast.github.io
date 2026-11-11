/* Accessible profile feed: URL state, shortest-column layout and native FLIP. */
(() => {
  "use strict";
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
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const normalize = (value) =>
    String(value || "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase(document.documentElement.lang || "en");
  const views = new Set(["featured", "all", "projects", "writing", "papers", "blogs", "research", "talks"]);
  const sorts = new Set(["recommended", "newest", "oldest", "updated"]);
  const projectTypes = new Set(["all", "independent", "contributions"]);
  document.querySelectorAll("[data-profile-feed]").forEach((root) => {
    const grid = root.querySelector("[data-feed-grid]");
    const input = root.querySelector("[data-feed-search]");
    const sort = root.querySelector("[data-feed-sort]");
    const projectFilters = root.querySelector("[data-project-filters]");
    const projectButtons = [...root.querySelectorAll("[data-project-filter]")];
    const clear = root.querySelector("[data-feed-clear]");
    const buttons = [...root.querySelectorAll("button[data-feed-view]")];
    const empty = root.querySelector("[data-feed-empty]");
    const count = root.querySelector("[data-feed-count]");
    const context = root.querySelector("[data-feed-context]");
    const emptyTitle = root.querySelector("[data-feed-empty-title]");
    const emptyDescription = root.querySelector("[data-feed-empty-description]");
    const tabGroup = root.querySelector(".feed-tabs");
    const pressedButtons = tabGroup ? buttons.filter((button) => tabGroup.contains(button)) : buttons;
    if (!grid || !input || !sort || !buttons.length) return;
    const cards = [...grid.children].filter((item) => item.matches("[data-feed-item]"));
    const originalGridAttributes = new Map(["role", "tabindex", "aria-label"].map((name) => [name, grid.getAttribute(name)]));
    const timestamp = (value) => {
      const parsed = /^-?\d+(?:\.\d+)?$/.test(value || "") ? Number(value) : Date.parse(value || "");
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const records = new Map(
      cards.map((item, index) => [
        item,
        {
          item,
          index,
          visible: false,
          staged: false,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          animation: null,
          rank: Number.isFinite(Number(item.dataset.feedRank)) ? Number(item.dataset.feedRank) : index,
          date: timestamp(item.dataset.feedDate),
          activity: timestamp(item.dataset.feedActivity) || timestamp(item.dataset.feedDate),
          text: normalize(item.dataset.feedText || item.dataset.feedSearch || item.textContent),
        },
      ])
    );
    let state;
    let selected = [];
    let frame = 0;
    let revision = 0;
    let stageFrame = 0;
    let gridWidth = 0;
    let animateNext = false;
    let initialized = false;
    const defaultView = views.has(root.dataset.feedDefault) ? root.dataset.feedDefault : "featured";
    const modern = root.dataset.feedDefault === "all";
    const canonicalView = (value) => (modern ? { featured: "all", writing: "blogs", papers: "research" }[value] || value : value);
    const read = () => {
      const params = new URLSearchParams(location.search);
      return {
        view: views.has(params.get("view")) ? canonicalView(params.get("view")) : defaultView,
        sort: sorts.has(params.get("sort")) ? params.get("sort") : "recommended",
        query: params.get("q") || "",
        project:
          canonicalView(params.get("view") || defaultView) === "projects" && projectTypes.has(params.get("project")) ? params.get("project") : "all",
      };
    };
    const write = (mode) => {
      const url = new URL(location.href);
      [
        ["view", state.view === defaultView ? "" : state.view],
        ["sort", state.sort === "recommended" ? "" : state.sort],
        ["q", state.query.trim()],
        ["project", state.view === "projects" && state.project !== "all" ? state.project : ""],
      ].forEach(([key, value]) => (value ? url.searchParams.set(key, value) : url.searchParams.delete(key)));
      if (url.href !== location.href) history[mode === "push" ? "pushState" : "replaceState"](history.state, "", url);
    };
    const settle = () => {
      root.dataset.feedBusy = String(!!frame || !!stageFrame || [...records.values()].some((record) => !!record.animation));
    };
    const cancel = (record) => {
      record.animation?.cancel();
      record.animation = null;
    };
    const animate = (record, from, to, exit = false) => {
      if (reduced.matches || document.hidden || typeof record.item.animate !== "function") return false;
      const animation = record.item.animate([from, to], {
        duration: exit ? 110 : 240,
        easing: exit ? "ease-in" : "cubic-bezier(.2,0,0,1)",
        fill: "both",
      });
      record.animation = animation;
      animation.finished
        .then(() => {
          if (record.animation !== animation) return;
          record.animation = null;
          animation.cancel();
          if (exit && !selected.includes(record.item)) record.item.hidden = true;
          settle();
        })
        .catch(() => {});
      return true;
    };
    const transform = (x, y) => `translate3d(${x}px,${y}px,0)`;
    const schedule = (animated = false) => {
      animateNext ||= animated;
      root.dataset.feedBusy = "true";
      if (!frame) frame = requestAnimationFrame(prepare);
    };
    const prepare = () => {
      frame = 0;
      const version = ++revision;
      if (stageFrame) cancelAnimationFrame(stageFrame);
      const width = grid.clientWidth;
      if (width <= 0) return;
      const style = getComputedStyle(grid);
      const gap = Math.max(0, Number(grid.dataset.feedGap) || parseFloat(style.columnGap) || 22);
      const minimum = Math.max(160, Number(grid.dataset.feedMinWidth) || parseFloat(style.getPropertyValue("--feed-min-width")) || 270);
      // Each category owns its density; CSS supplies the same column contract to
      // the readable grid fallback and this animated shortest-column layout.
      const preferredColumns = Math.trunc(parseFloat(style.getPropertyValue("--feed-columns")));
      const columns =
        Number.isFinite(preferredColumns) && preferredColumns > 0
          ? Math.min(12, preferredColumns)
          : Math.max(1, Math.floor((width + gap) / (minimum + gap)));
      const columnWidth = (width - gap * (columns - 1)) / columns;
      const geometry = new Map();
      const bounds = grid.getBoundingClientRect();
      const scrollTop = grid.scrollTop,
        scrollLeft = grid.scrollLeft;
      const stagedY = Math.max(bounds.height + gap, scrollTop + innerHeight * 2);
      // Capture every visual position before cancelling interrupted animations.
      records.forEach((record, item) => {
        if (!item.hidden && (!initialized || record.visible || record.animation)) {
          const rect = item.getBoundingClientRect();
          geometry.set(item, {
            x: rect.left - bounds.left + scrollLeft,
            y: rect.top - bounds.top + scrollTop,
            opacity: getComputedStyle(item).opacity,
          });
        }
      });
      let changedWidth = Math.abs(width - gridWidth) > 0.5;
      gridWidth = width;
      if (!initialized) grid.style.height = `${bounds.height}px`;
      grid.dataset.feedEnhanced = "true";
      if (!initialized) Object.assign(grid.style, { display: "block", position: "relative" });
      records.forEach((record, item) => {
        const resized = Math.abs(record.width - columnWidth) > 0.5;
        if (resized) changedWidth = true;
        record.width = columnWidth;
        const before = geometry.get(item);
        if (!initialized && before) {
          // Preserve the readable fallback positions throughout text measurement.
          item.style.transform = transform(before.x, before.y);
        } else if (initialized && selected.includes(item) && !record.visible && !record.animation) {
          // Newly revealed cards must be measurable without flashing at (0,0)
          // or turning below-fold images into visible LCP candidates.
          record.staged = true;
          item.style.opacity = "0";
          item.inert = true;
          item.setAttribute("aria-hidden", "true");
          item.style.transform = transform(0, stagedY);
        }
        if (!initialized) Object.assign(item.style, { position: "absolute", top: "0", left: "0", width: `${columnWidth}px`, margin: "0" });
        else if (resized) item.style.width = `${columnWidth}px`;
        if (selected.includes(item)) item.hidden = false;
      });
      if (changedWidth) document.dispatchEvent(new Event("portfolio:content-updated"));
      // Give the shared cached text composer its width before reading final heights.
      stageFrame = requestAnimationFrame(() => {
        stageFrame = requestAnimationFrame(() => {
          stageFrame = 0;
          if (version !== revision) return;
          layout(columnWidth, columns, gap, geometry);
        });
      });
    };
    const layout = (width, columns, gap, geometry) => {
      const shouldAnimate = initialized && animateNext && !reduced.matches && !document.hidden;
      animateNext = false;
      const gridTop = grid.getBoundingClientRect().top;
      const nearViewport = (y, height) => gridTop + y + height > -80 && gridTop + y < innerHeight + 80;
      const heights = new Map(selected.map((item) => [item, item.getBoundingClientRect().height]));
      const tracks = Array(columns).fill(0);
      const destinations = new Map();
      selected.forEach((item) => {
        const column = tracks.indexOf(Math.min(...tracks));
        const x = column * (width + gap),
          y = tracks[column];
        destinations.set(item, { x, y, height: heights.get(item) });
        tracks[column] += heights.get(item) + gap;
      });
      // All measurements are finished. Commit the new layout in one write batch.
      records.forEach((record, item) => {
        const target = destinations.get(item);
        const before = geometry.get(item);
        if (!target) {
          if (item.hidden) return;
          cancel(record);
          record.visible = false;
          if (record.staged) {
            record.staged = false;
            item.hidden = true;
            return;
          }
          const exited =
            shouldAnimate &&
            before &&
            nearViewport(before.y, record.height) &&
            animate(
              record,
              { transform: transform(before.x, before.y), opacity: before.opacity },
              { transform: transform(before.x, before.y + 4), opacity: 0 },
              true
            );
          if (!exited) item.hidden = true;
          return;
        }
        const moved = !record.visible || Math.abs(record.x - target.x) > 0.5 || Math.abs(record.y - target.y) > 0.5;
        if (moved || (record.animation && !shouldAnimate)) cancel(record);
        item.style.transform = transform(target.x, target.y);
        item.style.opacity = "1";
        item.inert = false;
        item.setAttribute("aria-hidden", "false");
        record.staged = false;
        if (shouldAnimate && moved && nearViewport(target.y, target.height))
          animate(
            record,
            {
              transform: transform(
                before && nearViewport(before.y, record.height) ? before.x : target.x,
                before && nearViewport(before.y, record.height) ? before.y : target.y + 10
              ),
              opacity: before && nearViewport(before.y, record.height) ? before.opacity : 0,
            },
            { transform: transform(target.x, target.y), opacity: 1 }
          );
        Object.assign(record, { visible: true, x: target.x, y: target.y, height: target.height });
      });
      grid.style.height = `${Math.max(0, ...tracks) - (selected.length ? gap : 0)}px`;
      root.dataset.feedReady = "true";
      initialized = true;
      settle();
    };
    const apply = (mode, animated = true) => {
      const words = normalize(state.query.trim()).split(/\s+/u).filter(Boolean);
      const kind = { projects: "project", writing: "writing", blogs: "writing", papers: "paper", research: "paper", talks: "talk" }[state.view];
      selected = cards
        .filter(
          (item) =>
            (!item.hasAttribute("data-feed-only-featured") || state.view === "featured") &&
            (state.view !== "featured" || item.dataset.feedFeatured === "true") &&
            (!kind || item.dataset.feedKind === kind) &&
            (state.view !== "projects" || !state.project || state.project === "all" || item.dataset.feedProjectType === state.project) &&
            words.every((word) => records.get(item).text.includes(word))
        )
        .sort((a, b) => {
          const first = records.get(a),
            second = records.get(b);
          return (
            (state.sort === "newest"
              ? second.date - first.date
              : state.sort === "oldest"
                ? first.date - second.date
                : state.sort === "updated"
                  ? second.activity - first.activity
                  : first.rank - second.rank) || first.index - second.index
          );
        });
      const wanted = new Set(selected);
      if (cards.some((item) => !wanted.has(item) && item.contains(document.activeElement))) {
        (buttons.find((button) => button.dataset.feedView === state.view) || input).focus({ preventScroll: true });
      }
      cards.forEach((item) => {
        const visible = wanted.has(item);
        item.dataset.feedVisible = String(visible);
        if (!initialized) item.hidden = !visible;
        item.inert = !visible;
        item.setAttribute("aria-hidden", String(!visible));
      });
      const order = [...selected, ...cards.filter((item) => !wanted.has(item))];
      if (order.some((item, index) => grid.children[index] !== item)) {
        const focused = document.activeElement;
        const preserveFocus = grid.contains(focused) && !focused.closest("[inert],[hidden]");
        grid.append(...order);
        if (preserveFocus && document.activeElement !== focused) focused.focus({ preventScroll: true });
      }
      pressedButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.feedView === state.view)));
      document.querySelectorAll("a[data-feed-link]").forEach((link) => {
        const url = new URL(link.href, location.href);
        const parentWork = modern && !url.searchParams.has("view");
        if (
          url.origin === location.origin &&
          url.pathname === location.pathname &&
          (parentWork || canonicalView(url.searchParams.get("view") || defaultView) === state.view)
        )
          link.setAttribute("aria-current", "page");
        else if (url.pathname === location.pathname) link.removeAttribute("aria-current");
      });
      input.value = state.query;
      sort.value = state.sort;
      if (clear) clear.hidden = !state.query;
      if (projectFilters) projectFilters.hidden = state.view !== "projects";
      projectButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.projectFilter === state.project)));
      root.dataset.feedProjectType = state.view === "projects" ? state.project || "all" : "all";
      if (count)
        count.textContent = label(
          `feed.count_${selected.length === 1 ? "singular" : "plural"}`,
          selected.length === 1 ? "{count} item" : "{count} items",
          { count: selected.length }
        );
      if (context)
        context.textContent = label(
          `feed.descriptions.${state.view}`,
          {
            featured: "Selected projects and writing.",
            all: "Projects, writing and research.",
            projects: "Practical systems and open-source work.",
            writing: "Articles and field notes.",
            blogs: "Articles and field notes.",
            papers: "Research papers and publications.",
            research: "Research papers and publications.",
            talks: "Workshops, keynotes, and technical presentations.",
          }[state.view]
        );
      const noPapers = ["papers", "research"].includes(state.view) && !state.query.trim() && !cards.some((item) => item.dataset.feedKind === "paper");
      const noTalks = state.view === "talks" && !state.query.trim() && !cards.some((item) => item.dataset.feedKind === "talk");
      if (emptyTitle)
        emptyTitle.textContent = label(
          noTalks ? "feed.talks_empty_title" : noPapers ? "feed.papers_empty_title" : "feed.empty_title",
          noTalks ? "Talks & Workshops" : noPapers ? "Research publications" : "No matching items"
        );
      if (emptyDescription)
        emptyDescription.textContent = label(
          noTalks ? "feed.talks_empty_description" : noPapers ? "feed.papers_empty_description" : "feed.empty_description",
          noTalks
            ? "Technical workshops and conference presentations will be added here."
            : noPapers
              ? "Publication details will appear here when they are added."
              : "Try another search or choose a different category."
        );
      if (empty) empty.hidden = selected.length !== 0;
      const scrollWriting = root.dataset.feedWritingScroll === "true" && ["writing", "blogs"].includes(state.view) && selected.length > 0;
      const wasScrollable = grid.dataset.feedScrollable === "true";
      grid.dataset.feedScrollable = String(scrollWriting);
      if (scrollWriting) {
        grid.tabIndex = 0;
        grid.setAttribute("role", "region");
        grid.setAttribute("aria-label", root.dataset.feedWritingLabel || "Writing");
      } else {
        originalGridAttributes.forEach((value, name) => (value === null ? grid.removeAttribute(name) : grid.setAttribute(name, value)));
        if (wasScrollable) {
          grid.scrollTop = 0;
          grid.scrollLeft = 0;
        }
      }
      root.dataset.feedCurrentView = state.view;
      root.dataset.feedCurrentSort = state.sort;
      if (mode) write(mode);
      root.dispatchEvent(
        new CustomEvent("portfolio:feed-change", {
          bubbles: true,
          detail: { view: state.view, sort: state.sort, count: selected.length, query: state.query, project: state.project || "all" },
        })
      );
      document.dispatchEvent(new Event("portfolio:filter"));
      schedule(animated);
    };
    buttons.forEach((button) =>
      button.addEventListener("click", () => {
        const nextView = canonicalView(button.dataset.feedView);
        if (nextView === state.view) return;
        state.view = nextView;
        state.project = "all";
        apply("push");
      })
    );
    projectButtons.forEach((button) =>
      button.addEventListener("click", () => {
        const next = button.dataset.projectFilter;
        if (!projectTypes.has(next) || (state.project === next && state.view === "projects")) return;
        state.view = "projects";
        state.project = next;
        apply("push");
      })
    );
    clear?.addEventListener("click", () => {
      input.focus({ preventScroll: true });
      state.query = "";
      apply("replace");
    });
    input.addEventListener("input", () => {
      state.query = input.value;
      apply("replace");
    });
    sort.addEventListener("change", () => {
      state.sort = sorts.has(sort.value) ? sort.value : "recommended";
      apply("push");
    });
    root.querySelectorAll("[data-feed-reset]").forEach((button) =>
      button.addEventListener("click", () => {
        state = { view: button.closest("[data-feed-empty]") ? "all" : defaultView, sort: "recommended", query: "", project: "all" };
        apply("push");
        input.focus();
      })
    );
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[data-feed-link]");
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (link.target && link.target !== "_self") ||
        link.hasAttribute("download")
      )
        return;
      const url = new URL(link.href, location.href);
      if (
        url.origin !== location.origin ||
        url.pathname !== location.pathname ||
        (url.searchParams.has("view") && !views.has(url.searchParams.get("view")))
      )
        return;
      event.preventDefault();
      state.view = canonicalView(url.searchParams.get("view") || defaultView);
      state.project = state.view === "projects" && projectTypes.has(url.searchParams.get("project")) ? url.searchParams.get("project") : "all";
      apply("push");
    });
    addEventListener("popstate", (event) => {
      if (event.state?.__portfolioContentOverlay) return;
      const next = read();
      if (next.view === state.view && next.sort === state.sort && next.query === state.query && next.project === state.project) return;
      state = next;
      apply(null);
    });
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver((entries) => {
        let changed = false;
        for (const entry of entries) {
          if (entry.target === grid) changed ||= Math.abs(entry.contentRect.width - gridWidth) > 0.5;
          else {
            const record = records.get(entry.target);
            if (record && record.visible && Math.abs(entry.target.getBoundingClientRect().height - record.height) > 0.5) changed = true;
          }
        }
        if (changed) schedule();
      });
      observer.observe(grid);
      cards.forEach((item) => observer.observe(item));
    } else addEventListener("resize", () => schedule());
    const stop = () => {
      records.forEach((record) => cancel(record));
      schedule();
    };
    reduced.addEventListener("change", stop);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
    });
    addEventListener("pagehide", () => records.forEach((record) => cancel(record)));
    addEventListener("pageshow", () => schedule());
    document.addEventListener("portfolio:overlay-state", (event) => {
      if (event.detail?.open)
        records.forEach((record) => {
          try {
            record.animation?.finish();
          } catch {}
        });
    });
    document.fonts?.ready.then(() => schedule());
    document.fonts?.addEventListener("loadingdone", () => schedule());
    root.querySelectorAll("[data-enable-with-js]").forEach((control) => {
      control.disabled = false;
      control.hidden = false;
    });
    const initLuxurySort = () => {
      const sortContainer = sort.closest(".feed-sort");
      if (!sortContainer || sortContainer.querySelector(".luxury-sort-dropdown")) return;
      const dropdown = document.createElement("div");
      dropdown.className = "luxury-sort-dropdown";
      dropdown.setAttribute("role", "listbox");
      dropdown.setAttribute("aria-label", label("feed.sort", "Sort content"));
      dropdown.hidden = true;

      const options = [...sort.options];
      const items = options.map((opt) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "luxury-sort-item";
        item.setAttribute("role", "option");
        item.dataset.value = opt.value;
        item.setAttribute("aria-selected", String(opt.value === sort.value));
        item.innerHTML = `
          <span class="luxury-sort-item-label">${opt.textContent}</span>
          <svg class="luxury-sort-check" width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="4 11 8 15 16 6"></polyline>
          </svg>
        `;
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          sort.value = opt.value;
          sort.dispatchEvent(new Event("change", { bubbles: true }));
          close();
          sort.focus({ preventScroll: true });
        });
        dropdown.appendChild(item);
        return item;
      });

      sortContainer.appendChild(dropdown);

      const syncActive = () => {
        items.forEach((item) => {
          item.setAttribute("aria-selected", String(item.dataset.value === sort.value));
        });
      };

      const open = () => {
        syncActive();
        dropdown.hidden = false;
        sortContainer.dataset.open = "true";
        document.addEventListener("pointerdown", onDocPointerDown);
        document.addEventListener("keydown", onDocKey);
      };

      const close = () => {
        dropdown.hidden = true;
        sortContainer.dataset.open = "false";
        document.removeEventListener("pointerdown", onDocPointerDown);
        document.removeEventListener("keydown", onDocKey);
      };

      const onDocPointerDown = (e) => {
        if (!sortContainer.contains(e.target)) {
          close();
        }
      };

      const onDocKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
          sort.focus({ preventScroll: true });
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const curIndex = items.findIndex((it) => it.getAttribute("aria-selected") === "true");
          const nextIndex = e.key === "ArrowDown" ? (curIndex + 1) % items.length : (curIndex - 1 + items.length) % items.length;
          sort.value = items[nextIndex].dataset.value;
          sort.dispatchEvent(new Event("change", { bubbles: true }));
          syncActive();
        }
      };

      sortContainer.addEventListener("pointerdown", (e) => {
        if (dropdown.contains(e.target)) return;
        e.preventDefault();
        if (dropdown.hidden) open();
        else close();
      });

      sort.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " " || (e.altKey && e.key === "ArrowDown")) {
          e.preventDefault();
          if (dropdown.hidden) open();
          else close();
        }
      });

      sort.addEventListener("change", syncActive);
    };
    initLuxurySort();
    state = read();
    apply(null, false);
  });
})();
