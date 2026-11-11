/* Native, history-aware content views over the retained static profile. */
(() => {
  "use strict";
  const host = document.querySelector("[data-content-overlay-host], [data-profile-feed]");
  const dialog = document.querySelector("[data-content-overlay-dialog]");
  if (!host || !dialog || typeof dialog.showModal !== "function") return;
  const body = dialog.querySelector("[data-overlay-body]");
  const title = dialog.querySelector("[data-overlay-title]");
  const contextLabel = dialog.querySelector("[data-overlay-context]");
  const status = dialog.querySelector("[data-overlay-status]");
  const error = dialog.querySelector("[data-overlay-error]");
  const message = dialog.querySelector("[data-overlay-error-message]");
  const closeButton = dialog.querySelector("[data-overlay-close]");
  const retry = dialog.querySelector("[data-overlay-retry]");
  const openPage = dialog.querySelector("[data-overlay-open-page]");
  if (!body || !title || !status || !error || !message || !closeButton || !retry || !openPage) return;
  const ui = (() => {
    try {
      return JSON.parse(document.getElementById("portfolio-ui")?.textContent || "{}");
    } catch {
      return {};
    }
  })();
  const label = (key, fallback) => (typeof ui.overlay?.[key] === "string" ? ui.overlay[key] : fallback);
  const markerKey = "__portfolioContentOverlay";
  const session = globalThis.crypto?.randomUUID?.() || `overlay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const profilePath = location.pathname;
  const cache = new Map();
  let pending = null;
  let generation = 0;
  let currentURL = null;
  let currentKind = "";
  let base = null;
  let invoker = null;
  let mounted = false;
  const restoration = history.scrollRestoration;
  let gutter = "";
  let restoreFrame = 0;
  let closing = false;
  const stateObject = () => (history.state && typeof history.state === "object" && !Array.isArray(history.state) ? history.state : {});
  const marker = () => stateObject()[markerKey];
  // A freshly loaded deep link is always a normal static page.
  if (marker()) {
    const clean = { ...stateObject() };
    delete clean[markerKey];
    history.replaceState(clean, "", location.href);
  }
  const hashID = (hash) => {
    try {
      return decodeURIComponent(hash.slice(1));
    } catch {
      return hash.slice(1);
    }
  };
  const safeURL = (value, reference = location.href, resource = false) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, reference);
      if (url.username || url.password) return null;
      if (["http:", "https:"].includes(url.protocol)) return url;
      if (!resource && ["mailto:", "tel:"].includes(url.protocol)) return url;
      if (resource && /^data:image\/(?:png|jpe?g|webp|avif|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return url;
    } catch {}
    return null;
  };
  const pathKind = (url, explicit = false) => {
    if (url.origin !== location.origin || !["http:", "https:"].includes(url.protocol)) return null;
    const path = url.pathname.replace(/\/+/g, "/");
    if (/\/projects\/[^/]+\/?$/.test(path)) return "project";
    if (/\/blog\/\d{4}\/[^/]+\/?$/.test(path)) return "writing";
    if (/\/research\/[^/]+\/?$/.test(path)) return "paper";
    if (/\/talks\/[^/]+\/?$/.test(path)) return "talk";
    if (/\/about\/?$/.test(path)) return "about";
    if (/\/resume\/?$/.test(path)) return "resume";
    // Explicit hooks can support localized/baseurl content without opening lists/assets.
    if (
      explicit &&
      !/\/(?:assets|blog|projects|research|publications|talks)\/?$|\/(?:assets|tag|category|page)\//.test(path) &&
      !/\.[a-z0-9]+$/i.test(path)
    )
      return "page";
    return null;
  };
  const allowedTags = new Set(
    "a abbr address article aside audio b bdi bdo blockquote br button caption cite code col colgroup dd del details dfn div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img kbd li label main mark nav ol p picture pre q rp rt ruby s samp section small source span strong sub summary sup table tbody td tfoot th thead time tr u ul var video track svg g path rect circle polyline polygon line ellipse title desc defs clippath mask use".split(
      " "
    )
  );
  const forbiddenTags = new Set(
    "script style link meta base iframe object embed applet frame frameset portal template noscript form input textarea select option animate animatemotion animatetransform set foreignobject".split(
      " "
    )
  );
  const allowedAttributes = new Set(
    "id class title alt width height loading decoding fetchpriority href target rel src srcset sizes media type datetime lang dir role tabindex hidden disabled inert open controls poster for required autocomplete inputmode placeholder maxlength minlength action method preload colspan rowspan scope start reversed value name download viewbox d fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset cx cy x y x1 y1 x2 y2 rx ry r points xmlns preserveaspectratio clip-path mask transform opacity".split(
      " "
    )
  );
  const sanitize = (source, url) => {
    const doc = new DOMParser().parseFromString(source, "text/html");
    const main = doc.querySelector("main#main") || doc.querySelector("main");
    if (!main || !main.querySelector("h1,h2")) throw new Error("Missing page content");
    // Generated same-origin feature data travels separately from sanitized HTML.
    // The installed dispatcher validates feature IDs and resources; fetched script
    // elements are never imported or executed.
    let optionalFeatures = null;
    const payload = doc.querySelector('script[type="application/json"][data-optional-features]');
    if (payload && payload.textContent.length <= 131072) {
      try {
        const parsed = JSON.parse(payload.textContent);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.features) && parsed.features.length <= 32) {
          optionalFeatures = { ...parsed, features: [...new Set(parsed.features.filter((feature) => typeof feature === "string"))] };
        }
      } catch {
        /* A malformed optional manifest cannot prevent reading. */
      }
    }
    for (const script of [...main.querySelectorAll("script[type]")]) {
      const type = script.getAttribute("type").trim().toLowerCase();
      if (/^math\/tex(?:;\s*mode=display)?$/.test(type)) {
        const display = type.includes("display");
        const text = doc.createElement(display ? "div" : "span");
        text.dataset.mathSource = "true";
        text.textContent = (display ? "\\[" : "\\(") + script.textContent + (display ? "\\]" : "\\)");
        script.replaceWith(text);
      } else if (type === "text/tikz") {
        const pre = doc.createElement("pre"),
          code = doc.createElement("code");
        code.className = "language-tikz";
        code.textContent = script.textContent;
        pre.append(code);
        script.replaceWith(pre);
      }
    }
    const newsletterForms = new Set();
    if (optionalFeatures?.features.includes("newsletter")) {
      let formIndex = 0;
      for (const form of main.querySelectorAll("form[data-newsletter]")) {
        const action = safeURL(form.getAttribute("action"), url);
        if (
          !action ||
          action.protocol !== "https:" ||
          action.hostname !== "app.loops.so" ||
          action.port ||
          !/^\/api\/newsletter-form\/[a-z0-9_-]+\/?$/i.test(action.pathname)
        )
          continue;
        newsletterForms.add(form);
        form.setAttribute("action", action.href);
        form.setAttribute("method", "post");
        form.removeAttribute("target");
        for (const input of form.querySelectorAll('input[type="email"]')) {
          const oldID = input.id;
          input.id = `reader-newsletter-${++formIndex}`;
          input.name = "email";
          for (const label of form.querySelectorAll("label[for]")) if (label.htmlFor === oldID) label.htmlFor = input.id;
        }
      }
    }
    for (const element of [...main.querySelectorAll("*")].reverse()) {
      const tag = element.localName.toLowerCase();
      const safeNewsletter =
        (tag === "form" && newsletterForms.has(element)) ||
        (tag === "input" && element.getAttribute("type") === "email" && newsletterForms.has(element.closest("form")));
      if (tag === "object") {
        const pdf = safeURL(element.getAttribute("data"), url, true);
        if (!pdf || pdf.origin !== location.origin || !/\/assets\/pdf\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.pdf$/i.test(pdf.pathname)) {
          element.replaceWith(...element.childNodes);
          continue;
        }
        element.setAttribute("data", pdf.href);
        element.setAttribute("type", "application/pdf");
        if (!element.querySelector("a[href]")) {
          const link = doc.createElement("a");
          link.href = pdf.href;
          link.textContent = label("open_pdf", "Open PDF");
          element.append(link);
        }
      }
      if (tag === "iframe") {
        const target = safeURL(element.getAttribute("src"), url);
        if (target && ["http:", "https:"].includes(target.protocol)) {
          const link = doc.createElement("a");
          link.href = target.href;
          link.textContent = label("open_embedded", "Open embedded content");
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          element.replaceWith(link);
        } else element.remove();
        continue;
      }
      if (forbiddenTags.has(tag) && tag !== "object" && !safeNewsletter) {
        element.remove();
        continue;
      }
      if (!allowedTags.has(tag) && tag !== "object" && !safeNewsletter) {
        element.replaceWith(...element.childNodes);
        continue;
      }
      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();
        if (tag === "object" && name === "data") continue;
        if (name.startsWith("on") || (!allowedAttributes.has(name) && !name.startsWith("aria-") && !name.startsWith("data-"))) {
          element.removeAttribute(attribute.name);
          continue;
        }
        if (["href", "src", "poster"].includes(name)) {
          if (tag === "use") {
            if (!attribute.value.startsWith("#")) element.removeAttribute(attribute.name);
            continue;
          }
          const target = safeURL(attribute.value, url, name !== "href");
          if (target) element.setAttribute(attribute.name, target.href);
          else element.removeAttribute(attribute.name);
        } else if (name === "srcset") {
          const candidates = attribute.value
            .split(",")
            .map((part) => part.trim().split(/\s+/))
            .filter((parts) => parts.length <= 2 && (!parts[1] || /^\d+(?:\.\d+)?[wx]$/.test(parts[1])))
            .map((parts) => {
              const target = safeURL(parts[0], url, true);
              return target && [target.href, parts[1]].filter(Boolean).join(" ");
            })
            .filter(Boolean);
          if (candidates.length) element.setAttribute(name, candidates.join(", "));
          else element.removeAttribute(name);
        } else if (
          ["fill", "stroke", "clip-path", "mask"].includes(name) &&
          /url\(/i.test(attribute.value) &&
          !/^url\(#[\w-]+\)$/.test(attribute.value)
        )
          element.removeAttribute(name);
        else if (name === "tabindex" && !["0", "-1"].includes(attribute.value)) element.removeAttribute(name);
      }
      if (element.hasAttribute("autoplay")) element.removeAttribute("autoplay");
      if (element.getAttribute("target") === "_blank") element.setAttribute("rel", "noopener noreferrer");
      else if (element.hasAttribute("target") && element.getAttribute("target") !== "_self") element.removeAttribute("target");
      if (element.id.startsWith("content-overlay")) element.removeAttribute("id");
    }
    const fragment = document.createDocumentFragment();
    for (const child of [...main.childNodes]) fragment.append(document.importNode(child, true));
    return {
      fragment,
      optionalFeatures,
      title: (doc.title || main.querySelector("h1,h2").textContent).trim().slice(0, 300),
      heading: main.querySelector("h1,h2").textContent.trim().slice(0, 200),
    };
  };
  const documentKey = (url) => url.origin + url.pathname + url.search;
  const fetchDocument = (url) => {
    const key = documentKey(url);
    if (cache.has(key)) {
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return Promise.resolve(value);
    }
    if (pending?.key === key) return pending.promise;
    pending?.controller.abort();
    const controller = new AbortController();
    const request = { key, controller, promise: null };
    request.promise = (async () => {
      const response = await fetch(key, { signal: controller.signal, credentials: "same-origin", headers: { Accept: "text/html" } });
      const finalURL = new URL(response.url || key);
      if (
        !response.ok ||
        finalURL.origin !== location.origin ||
        !pathKind(finalURL, true) ||
        !/text\/html/i.test(response.headers.get("content-type") || "")
      )
        throw new Error("Page unavailable");
      if (Number(response.headers.get("content-length")) > 2000000) throw new Error("Page too large");
      const text = await response.text();
      if (text.length > 2000000) throw new Error("Page too large");
      const content = sanitize(text, finalURL.href);
      cache.set(key, content);
      while (cache.size > 6) cache.delete(cache.keys().next().value);
      return content;
    })().finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
    return request.promise;
  };
  const modalState = () => document.documentElement.classList.toggle("has-dialog", !!document.querySelector("dialog[open]"));
  const unmount = () => {
    if (mounted) document.querySelector("#image-viewer[open]")?.close();
    if (mounted)
      document.dispatchEvent(
        new CustomEvent("portfolio:content-unmounted", { detail: { scope: body, url: currentURL, kind: currentKind, scrollContainer: body } })
      );
    mounted = false;
    delete body.portfolioOptionalFeatures;
    body.replaceChildren();
  };
  const saveScroll = () => {
    const entry = marker();
    if (entry?.session === session && dialog.open)
      history.replaceState({ ...stateObject(), [markerKey]: { ...entry, scroll: body.scrollTop } }, "", location.href);
  };
  const show = async (url, kind, entry) => {
    const ticket = ++generation;
    if (restoreFrame) {
      cancelAnimationFrame(restoreFrame);
      restoreFrame = 0;
    }
    if (pending && pending.key !== documentKey(url)) pending.controller.abort();
    unmount();
    currentURL = url.href;
    currentKind = kind;
    if (contextLabel) {
      const key = { project: "projects", writing: "writing", paper: "research", talk: "talks", about: "about", resume: "cv" }[kind];
      contextLabel.textContent =
        ui.navigation?.[key] ||
        { project: "Projects", writing: "Blog", paper: "Research", talk: "Talks", about: "About", resume: "CV" }[kind] ||
        label("title", "Content");
    }
    title.textContent = label("loading_title", "Loading content");
    status.textContent = label("loading", "Loading…");
    status.hidden = false;
    error.hidden = true;
    openPage.href = url.href;
    body.setAttribute("aria-busy", "true");
    body.dataset.overlayKind = kind;
    dialog.dataset.overlayKind = kind;
    if (!dialog.open) {
      gutter = document.documentElement.style.scrollbarGutter;
      // Preserve a real classic scrollbar; overlay-scrollbar browsers must not
      // acquire a new 15px gutter and recompose the entire background catalog.
      if (innerWidth > document.documentElement.clientWidth) document.documentElement.style.scrollbarGutter = "stable";
      history.scrollRestoration = "manual";
      dialog.showModal();
      modalState();
      document.dispatchEvent(new CustomEvent("portfolio:overlay-state", { detail: { open: true } }));
      closeButton.focus({ preventScroll: true });
    } else closeButton.focus({ preventScroll: true });
    try {
      const content = await fetchDocument(url);
      if (ticket !== generation || !dialog.open) return;
      body.replaceChildren(content.fragment.cloneNode(true));
      mounted = true;
      body.portfolioOptionalFeatures = content.optionalFeatures;
      title.textContent = content.heading;
      document.title = content.title;
      body.removeAttribute("aria-busy");
      status.textContent = "";
      status.hidden = true;
      document.dispatchEvent(
        new CustomEvent("portfolio:content-mounted", {
          detail: { scope: body, url: url.href, kind, scrollContainer: body, optionalFeatures: content.optionalFeatures },
        })
      );
      document.dispatchEvent(new Event("portfolio:content-updated"));
      body.scrollTop = Number(entry.scroll) || 0;
      if (url.hash) {
        const target = [...body.querySelectorAll("[id]")].find((node) => node.id === hashID(url.hash));
        target?.scrollIntoView({ block: "start" });
      }
    } catch (exception) {
      if (ticket !== generation || !dialog.open) return;
      body.removeAttribute("aria-busy");
      title.textContent = label("error_title", "Content unavailable");
      document.title = label("error_title", "Content unavailable");
      status.textContent = "";
      status.hidden = true;
      error.hidden = false;
      message.textContent = label("error", "This page could not be loaded. Try again or open the full page.");
    }
  };
  const restore = () => {
    if (!dialog.open) return;
    generation++;
    pending?.controller.abort();
    pending = null;
    const image = document.querySelector("#image-viewer[open]");
    image?.close();
    unmount();
    dialog.close();
    modalState();
    currentURL = null;
    closing = false;
    document.title = base?.title || document.title;
    document.documentElement.style.scrollbarGutter = gutter;
    document.dispatchEvent(new CustomEvent("portfolio:overlay-state", { detail: { open: false } }));
    if (restoreFrame) cancelAnimationFrame(restoreFrame);
    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = 0;
      const target = invoker?.isConnected && !invoker.closest("[hidden],[inert]") ? invoker : document.getElementById("main");
      target?.focus({ preventScroll: true });
      const root = document.documentElement,
        behavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      if (base) scrollTo(base.x, base.y);
      root.style.scrollBehavior = behavior;
      requestAnimationFrame(() => {
        if (!dialog.open) history.scrollRestoration = restoration;
      });
    });
  };
  const close = () => {
    if (!dialog.open || closing) return;
    const entry = marker();
    if (entry?.session === session && Number.isInteger(entry.depth) && entry.depth > 0) {
      closing = true;
      history.go(-entry.depth);
    } else {
      if (base) history.replaceState(stateObject(), "", base.url);
      restore();
    }
  };
  const navigate = (url, kind, anchor) => {
    if (!dialog.open) {
      base = { url: location.href, title: document.title, x: scrollX, y: scrollY };
      invoker = anchor;
    }
    saveScroll();
    const previous = marker();
    const entry = { session, base, url: url.href, kind, depth: dialog.open && previous?.session === session ? previous.depth + 1 : 1, scroll: 0 };
    history.pushState({ ...stateObject(), [markerKey]: entry }, "", url.href);
    show(url, kind, entry);
  };
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest?.("a[href]");
    if (
      !anchor ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      anchor.hasAttribute("download") ||
      anchor.hasAttribute("data-overlay-native") ||
      (anchor.target && anchor.target !== "_self")
    )
      return;
    const url = safeURL(anchor.href);
    if (!url || url.origin !== location.origin) return;
    if (dialog.open && body.contains(anchor) && url.pathname === profilePath) {
      event.preventDefault();
      close();
      return;
    }
    if (url.pathname === location.pathname && url.search === location.search && url.hash) {
      if (!dialog.open || !body.contains(anchor)) return;
      const target = [...body.querySelectorAll("[id]")].find((node) => node.id === hashID(url.hash));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ block: "start" });
      const entry = marker();
      history.replaceState({ ...stateObject(), [markerKey]: { ...entry, url: url.href } }, "", url.href);
      return;
    }
    if (!body.contains(anchor) && !host.contains(anchor) && !anchor.hasAttribute("data-content-overlay")) return;
    // A link to the page already on screen (e.g. "About" on /about/) must not
    // open that same page in a reader on top of itself.
    if (!dialog.open && url.pathname === location.pathname && url.search === location.search) return;
    const kind = pathKind(url, anchor.hasAttribute("data-content-overlay"));
    if (!kind) return;
    event.preventDefault();
    navigate(url, kind, anchor);
  });
  closeButton.addEventListener("click", close);
  retry.addEventListener("click", () => {
    const entry = marker();
    if (currentURL) show(new URL(currentURL), currentKind, entry || {});
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (document.querySelector("dialog[open]:not(#content-overlay)")) return;
    close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  addEventListener("popstate", (event) => {
    const entry = event.state?.[markerKey];
    if (entry?.session === session) {
      const url = safeURL(entry.url),
        original = safeURL(entry.base?.url);
      if (
        !url ||
        !original ||
        url.origin !== location.origin ||
        original.origin !== location.origin ||
        original.pathname !== profilePath ||
        url.href !== location.href ||
        !pathKind(url, true)
      )
        return;
      base = entry.base;
      closing = false;
      show(url, pathKind(url, true), entry);
      return;
    }
    // History entries from an earlier document (e.g. a reader URL that was
    // reloaded as a full page) cannot be restored in place: once Back changes
    // the path away from the loaded document, load the real page instead.
    if (!dialog.open && location.pathname !== profilePath) {
      location.reload();
      return;
    }
    restore();
  });
  addEventListener("pagehide", () => {
    generation++;
    pending?.controller.abort();
  });
})();
