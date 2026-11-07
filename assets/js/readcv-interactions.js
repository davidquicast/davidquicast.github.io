/* Native portfolio search, image viewing and autonomous project previews. */
(() => {
  "use strict";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const ui = (() => {
    try {
      return JSON.parse(document.getElementById("portfolio-ui")?.textContent || "{}");
    } catch {
      return {};
    }
  })();
  const label = (path, fallback, values = {}) => {
    const value = path.split(".").reduce((node, key) => (node && typeof node === "object" ? node[key] : undefined), ui);
    const text = typeof value === "string" && value ? value : fallback;
    return text.replace(/\{(\w+)\}/g, (match, key) => (Object.hasOwn(values, key) ? String(values[key]) : match));
  };
  const normalize = (value) =>
    String(value || "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase(document.documentElement.lang || "en");
  const notifyComposition = () => document.dispatchEvent(new Event("portfolio:content-updated"));
  const animateEntry = (element, direction = "x") => {
    if (motion.matches || typeof element.animate !== "function") return null;
    return element.animate([{ transform: direction === "x" ? "translateX(8px)" : "translateY(6px)" }, { transform: "translate(0)" }], {
      duration: 240,
      easing: "cubic-bezier(.2,0,0,1)",
    });
  };
  const editable = (target) => target instanceof Element && !!target.closest("input,textarea,select,[contenteditable]:not([contenteditable=false])");
  const imageZoomEnabled = document.body.dataset.imageZoom !== "false";
  const dialogSupported = typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal === "function";
  const syncModalState = () => document.documentElement.classList.toggle("has-dialog", !!document.querySelector("dialog[open]"));
  const returnFocus = (element) => {
    element = document.getElementById(element?.dataset?.lightboxReturnFocus || "") || element;
    if (element?.isConnected && !element.closest("[hidden],[inert]") && (!element.checkVisibility || element.checkVisibility()))
      element.focus({ preventScroll: true });
    else document.getElementById("main")?.focus({ preventScroll: true });
  };

  const search = document.querySelector("[data-search-dialog]");
  if (search && dialogSupported) {
    const input = search.querySelector("[data-global-search-input]");
    const results = search.querySelector("[data-global-search-results]");
    const status = search.querySelector("[data-global-search-status]");
    const recovery = search.querySelector("[data-global-search-recovery]");
    let invoker = null;
    let navigationTarget = null;
    let entries = null;
    let request = null;
    const resultLinks = () => [...results.querySelectorAll("a,button")];
    const validEntry = (entry) => {
      if (!entry || typeof entry.title !== "string") return null;
      const normalized = {
        title: entry.title.slice(0, 300),
        description: String(entry.description || "").slice(0, 1000),
        type: String(entry.type || "Page").slice(0, 30),
        tags: String(entry.tags || "").slice(0, 600),
        lang: typeof entry.lang === "string" && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(entry.lang) ? entry.lang : "",
      };
      if (normalized.type === "Action") {
        return ["light", "dark", "system"].includes(entry.action) ? { ...normalized, action: entry.action } : null;
      }
      if (typeof entry.url !== "string") return null;
      let url;
      try {
        url = new URL(entry.url, location.href);
      } catch {
        return null;
      }
      const internal = url.origin === location.origin && ["http:", "https:"].includes(url.protocol);
      // External destinations come only from the generated profile registry.
      // They remain real links; arbitrary document entries cannot navigate away.
      const profile =
        normalized.type === "Profile" &&
        (url.protocol === "https:" || (url.protocol === "mailto:" && !url.search && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(url.pathname)));
      if (!internal && !profile) return null;
      return { ...normalized, url: url.href, external: !internal && url.protocol === "https:" };
    };
    const render = () => {
      if (!entries) return;
      const query = normalize(input.value.trim());
      const words = query.split(/\s+/u).filter(Boolean);
      const matches = entries
        .map((entry, index) => {
          const title = normalize(entry.title);
          const haystack = title + " " + normalize(entry.description + " " + entry.tags);
          if (!words.every((word) => haystack.includes(word))) return null;
          const rank = !query
            ? entry.type === "Page"
              ? 0
              : entry.type === "Action"
                ? 5
                : 10
            : title === query
              ? 0
              : title.startsWith(query)
                ? 1
                : title.includes(query)
                  ? 2
                  : 3;
          return { entry, rank, index };
        })
        .filter(Boolean)
        .sort((a, b) => a.rank - b.rank || a.index - b.index);
      const shown = matches.slice(0, 12);
      const fragment = document.createDocumentFragment();
      let previousType = "";
      shown.forEach(({ entry }) => {
        const item = document.createElement("li");
        const link = document.createElement(entry.action ? "button" : "a");
        const type = document.createElement("span");
        const title = document.createElement("span");
        const description = document.createElement("span");
        if (entry.action) {
          link.type = "button";
          link.addEventListener("click", () => {
            window.dispatchEvent(new CustomEvent("portfolio:set-theme", { detail: { theme: entry.action } }));
            search.close();
          });
        } else {
          link.href = entry.url;
          link.addEventListener("click", (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
            const url = new URL(entry.url, location.href);
            if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
              try {
                navigationTarget = document.getElementById(decodeURIComponent(url.hash.slice(1)));
              } catch {}
            }
            search.close();
          });
          if (entry.external) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }
        }
        link.className = "search-result";
        type.className = "search-result-type";
        type.textContent = label("types." + entry.type.toLowerCase(), entry.type);
        title.className = "search-result-title";
        title.textContent = entry.title;
        if (entry.lang) title.lang = description.lang = entry.lang;
        description.className = "search-result-description";
        description.textContent = entry.description;
        if (entry.type !== previousType) item.dataset.groupStart = "true";
        previousType = entry.type;
        link.append(type, title, description);
        item.append(link);
        fragment.append(item);
      });
      results.replaceChildren(fragment);
      status.textContent = !query
        ? label("search.explore", "Explore pages, projects and recent writing.")
        : !matches.length
          ? label("search.no_results", "No results. Try another name, topic or technology.")
          : matches.length > shown.length
            ? label("search.showing_results", "Showing {shown} of {count} results.", { shown: shown.length, count: matches.length })
            : label(
                matches.length === 1 ? "search.result_singular" : "search.result_plural",
                matches.length === 1 ? "{count} result." : "{count} results.",
                { count: matches.length }
              );
      recovery.hidden = true;
    };
    const load = async () => {
      if (entries) return render();
      if (request) return request;
      status.textContent = label("search.loading", "Loading search…");
      search.setAttribute("aria-busy", "true");
      recovery.hidden = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      request = (async () => {
        try {
          const indexUrl = new URL(search.dataset.searchIndex, location.href);
          if (indexUrl.origin !== location.origin) throw new Error("Invalid search location");
          const response = await fetch(indexUrl, { signal: controller.signal, credentials: "same-origin" });
          if (!response.ok) throw new Error("Search unavailable");
          const text = await response.text();
          if (text.length > 2000000) throw new Error("Search index too large");
          const data = JSON.parse(text);
          if (!Array.isArray(data)) throw new Error("Invalid search index");
          entries = data.slice(0, 2000).map(validEntry).filter(Boolean);
          render();
        } catch {
          status.textContent = label("search.error", "Search is temporarily unavailable.");
          recovery.hidden = false;
          results.replaceChildren();
        } finally {
          clearTimeout(timeout);
          search.removeAttribute("aria-busy");
          request = null;
        }
      })();
      return request;
    };
    const open = (trigger) => {
      if (search.open || document.querySelector("dialog[open]")) return;
      invoker = trigger instanceof HTMLElement ? trigger : document.activeElement;
      navigationTarget = null;
      search.showModal();
      syncModalState();
      input.focus({ preventScroll: true });
      load();
    };
    document.querySelectorAll("[data-search-open]").forEach((trigger) => {
      trigger.hidden = false;
      trigger.disabled = false;
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-controls", search.id);
      trigger.addEventListener("click", () => open(trigger));
    });
    search.querySelector("[data-search-close]").addEventListener("click", () => search.close());
    search.querySelector("[data-global-search-retry]").addEventListener("click", () => load());
    input.addEventListener("input", render);
    search.addEventListener("close", () => {
      syncModalState();
      if (navigationTarget?.isConnected) {
        const target = navigationTarget;
        navigationTarget = null;
        if (!target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
          target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
        }
        target.focus({ preventScroll: true });
      } else returnFocus(invoker);
    });
    search.addEventListener("click", (event) => {
      if (event.target !== search) return;
      const rect = search.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) search.close();
    });
    search.addEventListener("keydown", (event) => {
      // Search inputs can consume the first Escape to clear their value. Close
      // the dialog explicitly so Escape has one consistent meaning throughout.
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        search.close();
        return;
      }
      const links = resultLinks();
      if (!links.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const current = links.indexOf(document.activeElement);
        const next = event.key === "ArrowDown" ? (current + 1) % links.length : current <= 0 ? links.length - 1 : current - 1;
        links[next].focus();
      } else if (event.key === "Enter" && event.target === input) {
        event.preventDefault();
        links[0].click();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.isComposing || event.repeat || event.defaultPrevented) return;
      const shortcut = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !editable(event.target);
      if (!shortcut && !slash) return;
      if (document.querySelector("dialog[open]") && !search.open) return;
      event.preventDefault();
      if (search.open && shortcut) search.close();
      else if (!search.open) open(document.activeElement);
    });
    search.dataset.ready = "true";
  }

  if (imageZoomEnabled && dialogSupported) {
    const galleryIds = new WeakMap();
    let galleryNumber = 0;
    const imageDestination = (value) => {
      try {
        const url = new URL(value, location.href);
        return ["http:", "https:"].includes(url.protocol) && /\.(?:avif|webp|png|jpe?g|gif|svg|ico)$/i.test(url.pathname);
      } catch {
        return false;
      }
    };
    const adoptLegacyImages = () => {
      document.querySelectorAll("img[data-zoomable],picture[data-zoomable] img").forEach((image) => {
        if (image.closest("a")) return;
        const href = image.dataset.zoomSrc || image.src;
        if (!href) return;
        const visual = image.closest("picture") || image;
        const link = document.createElement("a");
        link.href = href;
        link.className = "native-image-link";
        link.dataset.lightbox = "";
        visual.before(link);
        link.append(visual);
      });
      document.querySelectorAll("a.spotlight[href],a.vbox-item[href],.pswp-gallery a[href],.spotlight-group a[href]").forEach((link) => {
        if (link.dataset.vbtype && link.dataset.vbtype !== "image") return;
        if (imageDestination(link.href)) link.dataset.lightbox = "";
      });
      document.querySelectorAll("a[data-lightbox]").forEach((link) => {
        if (link.dataset.nativeLightbox === "true") return;
        const container = link.closest(".pswp-gallery,.spotlight-group,[data-lightbox-gallery],article") || document.getElementById("main");
        if (!link.dataset.lightboxGroup && container) {
          if (!galleryIds.has(container)) galleryIds.set(container, `native-gallery-${++galleryNumber}`);
          link.dataset.lightboxGroup = link.dataset.gall || galleryIds.get(container);
        }
        const text =
          link.dataset.lightboxCaption ||
          link.dataset.title ||
          link.getAttribute("title") ||
          link.closest("figure")?.querySelector("figcaption")?.textContent ||
          link.querySelector("img")?.alt;
        if (text) link.dataset.lightboxCaption = text.trim();
        link.dataset.nativeLightbox = "true";
        link.setAttribute("aria-haspopup", "dialog");
      });
    };
    adoptLegacyImages();
    document.addEventListener("portfolio:content-updated", adoptLegacyImages);
    let viewer = null;
    let image = null;
    let caption = null;
    let position = null;
    let original = null;
    let previous = null;
    let next = null;
    let failure = null;
    let links = [];
    let index = 0;
    let invoker = null;
    let imageAnimation = null;
    const createViewer = () => {
      viewer = document.createElement("dialog");
      viewer.id = "image-viewer";
      viewer.className = "image-dialog";
      viewer.setAttribute("aria-labelledby", "image-viewer-title");
      viewer.setAttribute("aria-describedby", "image-viewer-caption");
      const heading = document.createElement("header");
      heading.className = "dialog-heading";
      const title = document.createElement("h2");
      title.id = "image-viewer-title";
      title.textContent = label("gallery.title", "Image preview");
      const close = document.createElement("button");
      close.type = "button";
      close.className = "dialog-close";
      close.textContent = label("gallery.close", "Close");
      close.setAttribute("aria-label", label("gallery.close", "Close image preview"));
      close.addEventListener("click", () => viewer.close());
      heading.append(title, close);
      const figure = document.createElement("figure");
      figure.className = "image-dialog-figure";
      image = document.createElement("img");
      image.decoding = "async";
      image.alt = "";
      caption = document.createElement("figcaption");
      caption.id = "image-viewer-caption";
      figure.append(image, caption);
      const footer = document.createElement("footer");
      footer.className = "image-dialog-footer";
      const controls = document.createElement("div");
      controls.className = "image-dialog-controls";
      previous = document.createElement("button");
      previous.type = "button";
      previous.textContent = label("gallery.previous", "Previous");
      previous.setAttribute("aria-label", label("gallery.previous", "Previous image"));
      next = document.createElement("button");
      next.type = "button";
      next.textContent = label("gallery.next", "Next");
      next.setAttribute("aria-label", label("gallery.next", "Next image"));
      position = document.createElement("span");
      position.setAttribute("role", "status");
      position.setAttribute("aria-live", "polite");
      controls.append(previous, position, next);
      original = document.createElement("a");
      original.textContent = label("gallery.open_original", "Open original image");
      original.target = "_blank";
      original.rel = "noopener noreferrer";
      footer.append(controls, original);
      failure = document.createElement("p");
      failure.className = "image-dialog-error";
      failure.hidden = true;
      failure.setAttribute("role", "status");
      failure.textContent = label("gallery.load_error", "This image could not load. You can try opening the original image.");
      viewer.append(heading, figure, failure, footer);
      document.body.append(viewer);
      previous.addEventListener("click", () => showImage(index - 1));
      next.addEventListener("click", () => showImage(index + 1));
      image.addEventListener("error", () => {
        failure.hidden = false;
      });
      image.addEventListener("load", () => {
        failure.hidden = true;
      });
      viewer.addEventListener("close", () => {
        imageAnimation?.cancel();
        syncModalState();
        returnFocus(invoker);
        links = [];
        invoker = null;
        image.removeAttribute("src");
      });
      viewer.addEventListener("keydown", (event) => {
        if (links.length < 2 || editable(event.target)) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          showImage(index + (event.key === "ArrowRight" ? 1 : -1));
        }
      });
      viewer.addEventListener("click", (event) => {
        if (event.target !== viewer) return;
        const rect = viewer.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) viewer.close();
      });
    };
    const safeImage = (link) => {
      try {
        const url = new URL(link.href, location.href);
        return ["http:", "https:"].includes(url.protocol) ? url.href : null;
      } catch {
        return null;
      }
    };
    const showImage = (value) => {
      index = (value + links.length) % links.length;
      const link = links[index];
      const source = link.querySelector("img");
      const text = link.dataset.lightboxCaption || source?.alt || label("gallery.caption_fallback", "Project image");
      failure.hidden = true;
      image.alt = source?.alt || text;
      image.src = safeImage(link);
      caption.textContent = text;
      original.href = safeImage(link);
      position.textContent = label("gallery.position", "{current} / {total}", { current: index + 1, total: links.length });
      previous.hidden = next.hidden = links.length < 2;
      imageAnimation?.cancel();
      imageAnimation = animateEntry(image);
    };
    document.addEventListener("click", (event) => {
      const target = event.target.closest?.("a[data-lightbox]");
      if (
        !target ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        !safeImage(target)
      )
        return;
      if (
        [...document.querySelectorAll("dialog[open]")].some((dialog) => !dialog.matches("[data-content-overlay-dialog]") || !dialog.contains(target))
      )
        return;
      const group = target.dataset.lightboxGroup;
      const candidates = group ? [...document.querySelectorAll("a[data-lightbox]")].filter((link) => link.dataset.lightboxGroup === group) : [target];
      links = candidates.filter((link, at, all) => safeImage(link) && all.findIndex((other) => safeImage(other) === safeImage(link)) === at);
      if (!links.length) return;
      event.preventDefault();
      invoker = target;
      if (!viewer) createViewer();
      const selected = links.findIndex((link) => safeImage(link) === safeImage(target));
      showImage(selected < 0 ? 0 : selected);
      viewer.showModal();
      syncModalState();
    });
    document.addEventListener("portfolio:content-unmounted", (event) => {
      const scope = event.detail?.scope;
      if (!(scope instanceof Element) || !invoker || !scope.contains(invoker)) return;
      invoker = null;
      links = [];
      imageAnimation?.cancel();
      if (viewer?.open) viewer.close();
      image?.removeAttribute("src");
    });
  }

  document.querySelectorAll("[data-project-deck]").forEach((deck) => {
    const slides = [...deck.querySelectorAll("[data-deck-slide]")];
    const controls = deck.querySelector("[data-deck-controls]");
    const indicators = [...deck.querySelectorAll("[data-deck-index]")];
    const pause = deck.querySelector("[data-deck-pause]");
    const timing = deck.querySelector("[data-deck-timing]");
    const progress = deck.querySelector("[data-deck-progress]");
    const status = deck.querySelector("[data-deck-status]");
    if (slides.length < 2 || !controls || !pause || !timing || !progress || !status) return;
    let current = 0;
    let visible = !("IntersectionObserver" in window);
    let paused = false;
    let hovered = deck.matches(":hover") && matchMedia("(hover:hover)").matches;
    let focused = deck.contains(document.activeElement);
    let readingOverride = false;
    let clock = null;
    let entrance = null;
    const supported = typeof progress.animate === "function";
    const allowed = () => supported && !motion.matches && !paused && visible && !document.hidden && ((!hovered && !focused) || readingOverride);
    const createClock = () => {
      clock = progress.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 6000, easing: "linear", fill: "both" });
      clock.onfinish = () => {
        if (allowed()) select(current + 1, false);
      };
    };
    const reconcile = () => {
      pause.textContent = paused ? label("motion.resume", "Resume") : label("motion.pause", "Pause");
      pause.setAttribute(
        "aria-label",
        paused
          ? label("motion.resume_previews", "Resume automatic project previews")
          : label("motion.pause_previews", "Pause automatic project previews")
      );
      pause.setAttribute("aria-pressed", String(paused));
      pause.hidden = timing.hidden = motion.matches || !supported;
      if (!allowed()) {
        clock?.pause();
        entrance?.cancel();
        deck.dataset.motion = "paused";
        deck.dataset.pauseReason = motion.matches
          ? "reduced-motion"
          : document.hidden
            ? "hidden-tab"
            : !visible
              ? "offscreen"
              : paused
                ? "manual"
                : focused
                  ? "focus"
                  : "hover";
        return;
      }
      deck.dataset.motion = "running";
      delete deck.dataset.pauseReason;
      if (!clock) createClock();
      else if (clock.playState === "finished") select(current + 1, false);
      else clock.play();
    };
    const select = (value, manual) => {
      const selected = (value + slides.length) % slides.length;
      clock?.cancel();
      clock = null;
      entrance?.cancel();
      current = selected;
      slides.forEach((slide, index) => {
        const inactive = index !== current;
        slide.toggleAttribute("data-inactive", inactive);
        slide.inert = inactive;
        slide.setAttribute("aria-hidden", String(inactive));
      });
      indicators.forEach((button, index) => button.setAttribute("aria-pressed", String(index === current)));
      deck.dataset.active = String(current);
      status.setAttribute("aria-live", manual ? "polite" : "off");
      status.textContent = label("motion.project_position", "Project {current} of {total}: {title}", {
        current: current + 1,
        total: slides.length,
        title: slides[current].querySelector("h2,h3")?.textContent.trim() || label("search.selected_project", "Selected project"),
      });
      notifyComposition();
      if ((manual || allowed()) && visible && !document.hidden) entrance = animateEntry(slides[current]);
      reconcile();
    };
    const manualSelect = (index) => {
      paused = true;
      readingOverride = false;
      select(index, true);
    };
    indicators.forEach((button, index) => button.addEventListener("click", () => manualSelect(index)));
    deck.querySelector("[data-deck-previous]")?.addEventListener("click", () => manualSelect(current - 1));
    deck.querySelector("[data-deck-next]")?.addEventListener("click", () => manualSelect(current + 1));
    pause.addEventListener("click", () => {
      paused = !paused;
      readingOverride = !paused;
      reconcile();
    });
    deck.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") {
        hovered = true;
        readingOverride = false;
        reconcile();
      }
    });
    deck.addEventListener("pointerleave", () => {
      hovered = false;
      reconcile();
    });
    deck.addEventListener("focusin", () => {
      focused = true;
      readingOverride = false;
      reconcile();
    });
    deck.addEventListener("focusout", (event) => {
      if (!deck.contains(event.relatedTarget)) {
        focused = false;
        reconcile();
      }
    });
    document.addEventListener("visibilitychange", reconcile);
    motion.addEventListener("change", () => {
      clock?.cancel();
      clock = null;
      reconcile();
    });
    addEventListener("pagehide", () => {
      clock?.pause();
      entrance?.cancel();
    });
    addEventListener("pageshow", reconcile);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries) => {
          visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.15;
          reconcile();
        },
        { threshold: [0, 0.15] }
      ).observe(deck);
    }
    controls.hidden = false;
    deck.dataset.deckEnhanced = "true";
    select(0, false);
  });
})();
