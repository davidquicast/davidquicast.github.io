(() => {
  "use strict";
  const runtimeKey = Symbol.for("portfolio.optionalFeatures");
  if (window[runtimeKey]) return;
  window[runtimeKey] = true;
  const entry = document.currentScript;
  const cssURL = entry?.dataset.optionalCss || new URL("../css/optional-features.css", entry?.src || location.href).href;
  const knownFeatures = new Set(
    "math mermaid chartjs echarts vega map diff pseudocode typograms comparison slider tikz table media_overlay masonry tabs giscus disqus badges research newsletter".split(
      " "
    )
  );
  const scopes = new WeakMap();
  const resources = new Map();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let scopeID = 0;
  let mathReady;
  let mathQueue = Promise.resolve();
  let labels = {};
  try {
    labels = JSON.parse(document.getElementById("portfolio-ui")?.textContent || "{}");
  } catch {
    /* Native English fallback. */
  }
  const label = (group, key, fallback) => labels[group]?.[key] || fallback;
  const theme = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const safeResource = (value) => {
    if (typeof value !== "string" || value.length > 4096) throw new Error("Invalid resource URL");
    const url = new URL(value, location.href);
    if (url.username || url.password || (url.protocol !== "https:" && !(url.origin === location.origin && url.protocol === location.protocol)))
      throw new Error("Unsupported resource URL");
    return url.href;
  };
  // Shared SDKs may finish loading after a scope closes. Their promises are bounded;
  // only an active scope may use the result to mount content.
  const load = (kind, value) => {
    let url;
    try {
      url = safeResource(value?.url);
    } catch (error) {
      return Promise.reject(error);
    }
    const key = kind + ":" + url;
    if (resources.has(key)) return resources.get(key).promise;
    if (resources.size >= 64) return Promise.reject(new Error("Resource budget exceeded"));
    if (kind === "css") {
      const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find((node) => node.href === url);
      if (existing) {
        const promise = Promise.resolve(existing);
        resources.set(key, { settled: true, promise });
        return promise;
      }
    }
    const record = { settled: false, promise: null };
    record.promise = new Promise((resolve, reject) => {
      const node = document.createElement(kind === "css" ? "link" : "script");
      if (kind === "css") {
        node.rel = "stylesheet";
        node.href = url;
      } else {
        node.src = url;
        node.async = false;
      }
      if (typeof value?.integrity === "string" && /^sha(256|384|512)-[A-Za-z0-9+/=]+$/.test(value.integrity)) {
        node.integrity = value.integrity;
        node.crossOrigin = "anonymous";
      }
      const finish = (error) => {
        clearTimeout(timer);
        node.onload = node.onerror = null;
        record.settled = true;
        if (error) {
          resources.delete(key);
          node.remove();
          reject(error);
        } else resolve(node);
      };
      const timer = setTimeout(() => finish(new Error("Resource timeout")), 15000);
      node.onload = () => finish();
      node.onerror = () => finish(new Error("Resource unavailable"));
      document.head.append(node);
    });
    resources.set(key, record);
    return record.promise;
  };
  const parseConfig = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.features)) return null;
    if (value.features.length > 32) return null;
    const features = [...new Set(value.features.filter((feature) => knownFeatures.has(feature)))];
    return features.length ? { ...value, features } : null;
  };
  const mount = (scope, rawConfig, context = {}) => {
    const config = parseConfig(rawConfig);
    if (!scope?.querySelectorAll || !config || scopes.has(scope)) return;
    const controller = new AbortController();
    const cleanups = [];
    const id = ++scopeID;
    const record = {
      dispose: () => {
        if (controller.signal.aborted) return;
        controller.abort();
        cleanups.reverse().forEach((cleanup) => {
          try {
            cleanup();
          } catch {
            /* Independent providers must not block disposal. */
          }
        });
        cleanups.length = 0;
        scopes.delete(scope);
      },
    };
    scopes.set(scope, record);
    const active = () => !controller.signal.aborted && (scope === document || scope.isConnected);
    const cleanup = (callback) => {
      if (typeof callback !== "function") return;
      if (active()) cleanups.push(callback);
      else callback();
    };
    const enabled = new Set(config.features);
    const all = (selector) => {
      const nodes = [...scope.querySelectorAll(selector)];
      if (scope.matches?.(selector)) nodes.unshift(scope);
      return nodes.filter((node) => scope !== document || !node.closest("[data-overlay-body]"));
    };
    const one = (selector) => all(selector)[0];
    const listen = (node, event, callback) => node.addEventListener(event, callback, { signal: controller.signal });
    const resource = (name, kind, branch) => {
      const lib = config.libraries?.[name] || {};
      return {
        url: branch ? lib.url?.[kind]?.[branch] : lib.url?.[kind],
        integrity: branch ? lib.integrity?.[kind]?.[branch] : lib.integrity?.[kind],
      };
    };
    const script = (name, branch) => load("js", resource(name, "js", branch));
    const style = (name) => (resource(name, "css").url ? load("css", resource(name, "css")) : Promise.resolve());
    const fail = (source) => {
      if (!active() || !source || source.nextElementSibling?.classList.contains("feature-error")) return;
      const status = document.createElement("p");
      status.className = "feature-error";
      status.setAttribute("role", "status");
      status.textContent = label("optional", "load_error", "Interactive content could not be loaded. The source remains available.");
      source.after(status);
      cleanup(() => status.remove());
    };
    const run = (prepare, render, source) =>
      Promise.resolve()
        .then(prepare)
        .then(() => {
          if (active()) return render();
        })
        .catch(() => fail(source));
    const sourceBlock = (code) => code.closest(".highlighter-rouge") || code.closest(".code-frame") || code.closest("pre");
    const blocks = (language) => [...new Set(all(`pre > code.language-${language}, .language-${language} pre > code`))];
    const renderBlocks = (kind, language, prepare, render) => {
      if (!enabled.has(kind)) return;
      const inputs = blocks(language);
      if (!inputs.length) return;
      run(
        prepare,
        async () => {
          for (const code of inputs) {
            if (!active()) break;
            const source = sourceBlock(code);
            const marker = document.createComment("optional-source");
            source.before(marker);
            const target = document.createElement("div");
            target.className = "feature-render" + (["mermaid", "typograms", "pseudocode", "tikz"].includes(kind) ? " feature-diagram" : "");
            target.dataset.feature = kind;
            source.after(target);
            let details;
            cleanup(() => {
              if (marker.parentNode)
                marker.replaceWith(source.contains(code) ? source : code.closest(".highlighter-rouge") || code.closest("pre") || source);
              details?.remove();
              target.remove();
            });
            try {
              cleanup(await render(target, code.textContent, code));
              if (!active()) {
                target.remove();
                continue;
              }
              details = document.createElement("details");
              details.className = "feature-source";
              const summary = document.createElement("summary");
              summary.textContent = label("optional", "view_source", "View source");
              details.append(summary);
              target.after(details);
              details.append(source);
              target.dataset.featureState = "ready";
            } catch {
              target.remove();
              fail(source);
            }
          }
        },
        sourceBlock(inputs[0])
      );
    };
    const resize = (target, callback) => {
      const observer = new ResizeObserver(() => {
        if (active()) callback();
      });
      observer.observe(target);
      return () => observer.disconnect();
    };
    const math = () => {
      if (!mathReady) {
        if (!window.MathJax?.typesetPromise)
          window.MathJax = {
            startup: { typeset: false },
            tex: {
              tags: "ams",
              inlineMath: [
                ["$", "$"],
                ["\\(", "\\)"],
              ],
            },
            options: { skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"] },
          };
        mathReady = (window.MathJax?.typesetPromise ? Promise.resolve() : script("mathjax"))
          .then(() => window.MathJax.startup?.promise)
          .catch((error) => {
            mathReady = null;
            throw error;
          });
      }
      return mathReady;
    };
    // Local style is tiny and shared. No renderer library loads for flags alone.
    const visual = all(
      "pre > code, img-comparison-slider, swiper-container, [data-masonry], table[data-toggle=table], [data-content-tabs], [data-giscus], [data-disqus], .altmetric-embed, .__dimensions_badge_embed__, [data-newsletter], [data-research-search]"
    );
    if (visual.length) load("css", { url: cssURL }).catch(() => {});
    if (enabled.has("math") && (one('.math,[data-math],script[type^="math/tex"]') || /\\\(|\\\[|\$[^$\n]+\$/.test(scope.textContent)))
      run(
        math,
        () => {
          const target = one(".article-content,.paper-detail,.prose,[data-math]") || scope;
          mathQueue = mathQueue
            .catch(() => {})
            .then(() => (active() ? window.MathJax.typesetPromise?.([target]) : undefined))
            .finally(() => {
              if (!active()) window.MathJax.typesetClear?.([target]);
            });
          cleanup(() => window.MathJax.typesetClear?.([target]));
          return mathQueue;
        },
        one(".article-content,main") || scope
      );
    renderBlocks(
      "mermaid",
      "mermaid",
      () => script("mermaid"),
      async (target, text) => {
        window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: theme() === "dark" ? "dark" : "default" });
        const pre = document.createElement("pre");
        pre.className = "mermaid";
        pre.textContent = text;
        target.append(pre);
        await window.mermaid.run({ nodes: [pre] });
      }
    );
    renderBlocks(
      "chartjs",
      "chartjs",
      () => script("chartjs"),
      (target, text) => {
        const definition = JSON.parse(text);
        definition.options = { ...definition.options, responsive: true, maintainAspectRatio: false };
        if (reduced.matches) definition.options.animation = false;
        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-label", definition.options.plugins?.title?.text || "Chart");
        canvas.setAttribute("role", "img");
        target.append(canvas);
        const chart = new window.Chart(canvas, definition);
        return () => chart.destroy?.();
      }
    );
    renderBlocks(
      "echarts",
      "echarts",
      () => script("echarts", "library"),
      (target, text) => {
        const options = JSON.parse(text);
        if (reduced.matches) options.animation = false;
        options.aria = { ...options.aria, enabled: true };
        const chart = window.echarts.init(target, theme() === "dark" ? "dark" : undefined);
        const stop = resize(target, () => chart.resize());
        try {
          chart.setOption(options);
        } catch (error) {
          stop();
          chart.dispose();
          throw error;
        }
        return () => {
          stop();
          chart.dispose();
        };
      }
    );
    renderBlocks(
      "vega",
      "vega_lite",
      async () => {
        await script("vega");
        await script("vega-lite");
        await script("vega-embed");
      },
      async (target, text) => {
        const result = await window.vegaEmbed(target, JSON.parse(text), { actions: false, theme: theme() === "dark" ? "dark" : undefined });
        return () => result.view?.finalize();
      }
    );
    renderBlocks(
      "map",
      "geojson",
      async () => {
        await style("leaflet");
        await script("leaflet");
      },
      (target, text) => {
        const data = JSON.parse(text);
        const map = window.L.map(target, { scrollWheelZoom: false });
        try {
          window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          }).addTo(map);
          const bounds = window.L.geoJSON(data).addTo(map).getBounds();
          if (bounds.isValid()) map.fitBounds(bounds);
          else map.setView([0, 0], 2);
        } catch (error) {
          map.remove();
          throw error;
        }
        const stop = resize(target, () => map.invalidateSize());
        return () => {
          stop();
          map.remove();
        };
      }
    );
    renderBlocks(
      "diff",
      "diff2html",
      async () => {
        await style("diff2html");
        await script("diff2html");
      },
      (target, text) => {
        new window.Diff2HtmlUI(target, text, { drawFileList: true, matching: "lines", colorScheme: theme() }).draw();
      }
    );
    renderBlocks(
      "pseudocode",
      "pseudocode",
      async () => {
        await math();
        await style("pseudocode");
        await script("pseudocode");
      },
      (target, text) => {
        const pre = document.createElement("pre");
        pre.textContent = text;
        target.append(pre);
        window.pseudocode.renderElement(pre, { throwOnError: true });
      }
    );
    renderBlocks(
      "typograms",
      "typograms",
      () => load("js", { url: config.typogramsUrl }),
      (target, text) => {
        target.append(window.create("\n" + text, 0.3, false));
      }
    );
    if (enabled.has("comparison") && one("img-comparison-slider"))
      run(
        () => Promise.all([style("img-comparison-slider"), script("img-comparison-slider")]),
        () => {},
        one("img-comparison-slider")
      );
    if (enabled.has("slider") && one("swiper-container"))
      run(
        () => Promise.all([style("swiper"), script("swiper")]),
        () => {
          all("swiper-container").forEach((slider) => cleanup(() => slider.swiper?.destroy?.(true, true)));
        },
        one("swiper-container")
      );
    if (enabled.has("tikz")) {
      // TikZJax v1 scans only at window load. Keep direct-page source and offer
      // its canonical URL in dynamic views rather than inventing a rescan API.
      const source = one('script[type="text/tikz"],pre > code.language-tikz');
      if (source && scope === document && document.readyState !== "complete")
        run(
          async () => {
            await load("css", { url: config.tikzCss });
            await load("js", { url: config.tikzUrl });
          },
          () => {},
          source
        );
      else if (source) {
        const link = document.createElement("a");
        link.href = context.url || location.href;
        link.textContent = label("optional", "open_direct", "Open the full page to render this diagram");
        (sourceBlock(source) || source).after(link);
        cleanup(() => link.remove());
      }
    }
    if (enabled.has("table") && one('table[data-toggle="table"]'))
      run(
        async () => {
          await style("bootstrap-table");
          await script("jquery");
          await script("bootstrap-table");
        },
        () => {
          all('table[data-toggle="table"]').forEach((table) => {
            window.jQuery(table).bootstrapTable();
            cleanup(() => window.jQuery(table).bootstrapTable("destroy"));
          });
        },
        one('table[data-toggle="table"]')
      );
    if (enabled.has("media_overlay")) {
      let viewer;
      let frame;
      let returnFocus;
      const closeMedia = () => {
        frame?.pause?.();
        frame?.remove();
        frame = null;
        if (viewer?.open) viewer.close();
      };
      all('[data-vbtype="video"]:not([data-native-lightbox]), [data-vbtype="iframe"]:not([data-native-lightbox])').forEach((link) => {
        listen(link, "click", (event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            !HTMLDialogElement.prototype.showModal
          )
            return;
          let url;
          try {
            url = new URL(safeResource(link.href));
          } catch {
            event.preventDefault();
            fail(link);
            return;
          }
          if (!viewer) {
            viewer = document.createElement("dialog");
            viewer.className = "image-dialog optional-media-dialog";
            const heading = document.createElement("div");
            heading.className = "dialog-heading";
            const title = document.createElement("h2");
            title.id = `optional-media-${id}`;
            viewer.setAttribute("aria-labelledby", title.id);
            const close = document.createElement("button");
            close.type = "button";
            close.className = "dialog-close";
            close.textContent = label("common", "close", "Close");
            heading.append(title, close);
            viewer.append(heading);
            document.body.append(viewer);
            listen(close, "click", closeMedia);
            listen(viewer, "keydown", (key) => {
              if (key.key === "Escape") {
                key.preventDefault();
                key.stopPropagation();
                closeMedia();
              }
            });
            listen(viewer, "cancel", (cancel) => {
              cancel.preventDefault();
              cancel.stopPropagation();
              closeMedia();
            });
            listen(viewer, "close", () => {
              frame?.pause?.();
              frame?.remove();
              frame = null;
              if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
            });
            listen(viewer, "click", (click) => {
              if (click.target === viewer) {
                const rect = viewer.getBoundingClientRect();
                if (click.clientX < rect.left || click.clientX > rect.right || click.clientY < rect.top || click.clientY > rect.bottom) closeMedia();
              }
            });
            cleanup(() => {
              closeMedia();
              viewer.remove();
            });
          }
          event.preventDefault();
          closeMedia();
          returnFocus = link;
          const title =
            link.dataset.title || link.getAttribute("title") || link.textContent.trim() || label("optional", "media_title", "Media preview");
          viewer.querySelector("h2").textContent = title;
          const isVideo = link.dataset.vbtype === "video" && /\.(mp4|webm|ogg|m4v)$/i.test(url.pathname);
          if (!isVideo) {
            if (
              /^(www\.)?(youtube\.com|youtube-nocookie\.com)$/.test(url.hostname) &&
              url.pathname === "/watch" &&
              /^[\w-]+$/.test(url.searchParams.get("v") || "")
            )
              url = new URL(`https://www.youtube-nocookie.com/embed/${url.searchParams.get("v")}`);
            if (url.hostname === "youtu.be" && /^\/[\w-]+$/.test(url.pathname))
              url = new URL(`https://www.youtube-nocookie.com/embed${url.pathname}`);
            if (/^(www\.)?vimeo\.com$/.test(url.hostname) && /^\/\d+$/.test(url.pathname))
              url = new URL(`https://player.vimeo.com/video${url.pathname}`);
          }
          frame = document.createElement(isVideo ? "video" : "iframe");
          if (isVideo) frame.controls = true;
          else {
            frame.title = title;
            frame.referrerPolicy = "strict-origin-when-cross-origin";
            frame.allowFullscreen = true;
            frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
          }
          frame.src = url.href;
          frame.className = "optional-media-frame";
          const footer = viewer.querySelector(".image-dialog-footer") || document.createElement("p");
          footer.className = "image-dialog-footer";
          footer.replaceChildren();
          const external = document.createElement("a");
          external.href = link.href;
          external.textContent = label("optional", "open_original", "Open original media");
          external.target = "_blank";
          external.rel = "noopener noreferrer";
          footer.append(external);
          viewer.append(frame, footer);
          viewer.showModal();
        });
      });
    }
    if (enabled.has("masonry") && one("[data-masonry]"))
      run(
        async () => {
          await script("imagesloaded");
          await script("masonry");
        },
        () => {
          all("[data-masonry]").forEach((grid) => {
            const masonry = new window.Masonry(grid, { itemSelector: "[data-masonry-item]", percentPosition: true });
            const images = window.imagesLoaded(grid);
            const update = () => {
              if (active()) masonry.layout();
            };
            images.on("progress", update);
            cleanup(() => {
              images.off("progress", update);
              masonry.destroy();
            });
          });
        },
        one("[data-masonry]")
      );
    if (enabled.has("tabs"))
      all("[data-content-tabs]").forEach((group, groupIndex) => {
        const controls = [...group.querySelectorAll("[data-tab-control]")];
        const panels = [...group.querySelectorAll("[data-tab-panel]")];
        const list = group.querySelector("[data-tab-controls]");
        if (!list || !controls.length || controls.length !== panels.length) return;
        const attrs = ["role", "aria-label", "aria-controls", "aria-selected", "aria-labelledby", "tabindex", "hidden", "id"];
        const original = [list, ...controls, ...panels].map((node) => [node, attrs.map((name) => [name, node.getAttribute(name)])]);
        cleanup(() =>
          original.forEach(([node, values]) =>
            values.forEach(([name, value]) => (value === null ? node.removeAttribute(name) : node.setAttribute(name, value)))
          )
        );
        list.setAttribute("role", "tablist");
        list.setAttribute("aria-label", group.dataset.name || "Content tabs");
        const activate = (index, focus) => {
          controls.forEach((control, position) => {
            const selected = position === index;
            control.id ||= `optional-${id}-${groupIndex}-tab-${position}`;
            panels[position].id ||= `optional-${id}-${groupIndex}-panel-${position}`;
            control.setAttribute("role", "tab");
            control.setAttribute("aria-controls", panels[position].id);
            control.setAttribute("aria-selected", String(selected));
            control.tabIndex = selected ? 0 : -1;
            panels[position].setAttribute("role", "tabpanel");
            panels[position].setAttribute("aria-labelledby", control.id);
            panels[position].tabIndex = 0;
            panels[position].hidden = !selected;
          });
          if (focus) controls[index].focus();
        };
        controls.forEach((control, index) => {
          listen(control, "click", (event) => {
            event.preventDefault();
            activate(index, false);
          });
          listen(control, "keydown", (event) => {
            const next = {
              ArrowRight: (index + 1) % controls.length,
              ArrowLeft: (index + controls.length - 1) % controls.length,
              Home: 0,
              End: controls.length - 1,
            }[event.key];
            if (next !== undefined) {
              event.preventDefault();
              activate(next, true);
            }
          });
        });
        const initial = panels.findIndex((panel) => "#" + panel.id === new URL(context.url || location.href, location.href).hash);
        activate(initial < 0 ? 0 : initial, false);
      });
    if (enabled.has("giscus"))
      all("[data-giscus]").forEach((host) => {
        const embed = document.createElement("script");
        embed.src = "https://giscus.app/client.js";
        embed.async = true;
        embed.crossOrigin = "anonymous";
        ["repo", "repo-id", "category", "category-id", "mapping", "strict", "reactions-enabled", "emit-metadata", "input-position", "lang"].forEach(
          (key) => {
            const value = host.getAttribute("data-" + key);
            if (value) embed.setAttribute("data-" + key, value);
          }
        );
        embed.setAttribute("data-theme", theme());
        host.append(embed);
        const observer = new MutationObserver(() => {
          if (active()) host.querySelector("iframe")?.contentWindow?.postMessage({ giscus: { setConfig: { theme: theme() } } }, "https://giscus.app");
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        cleanup(() => {
          observer.disconnect();
          embed.remove();
          host.querySelectorAll("iframe.giscus-frame,.giscus").forEach((node) => node.remove());
        });
      });
    if (enabled.has("disqus")) {
      const host = one("[data-disqus]");
      const shortname = host?.dataset.disqus;
      if (shortname && /^[a-z0-9-]+$/i.test(shortname) && shortname !== "multi-language-al-folio") {
        // Disqus owns one global thread. Leave a real direct-page link if another
        // mounted page already owns it; do not steal its frame across dialogs.
        const other = document.getElementById("disqus_thread");
        if (other && other !== host) {
          const link = document.createElement("a");
          link.href = context.url || location.href;
          link.textContent = "Read comments on the full page";
          host.append(link);
          cleanup(() => link.remove());
        } else {
          const oldID = host.id;
          host.id = "disqus_thread";
          const configure = function () {
            this.page.url = context.url || document.querySelector('link[rel="canonical"]')?.href || location.href;
            this.page.identifier = host.dataset.disqusId;
            this.page.title = host.dataset.title || document.title;
          };
          window.disqus_config = configure;
          run(
            () => (window.DISQUS ? Promise.resolve() : load("js", { url: "https://" + shortname + ".disqus.com/embed.js" })),
            () => {
              if (window.DISQUS?.reset) window.DISQUS.reset({ reload: true, config: configure });
            },
            host
          );
          cleanup(() => {
            host.id = oldID;
            host.querySelectorAll("iframe").forEach((node) => node.remove());
            if (window.disqus_config === configure) delete window.disqus_config;
          });
        }
      }
    }
    if (enabled.has("badges")) {
      if (one(".altmetric-embed"))
        run(
          () => load("js", { url: "https://d1bxh8uas1mnw7.cloudfront.net/assets/embed.js" }),
          () => window._altmetric_embed_init?.(),
          one(".altmetric-embed")
        );
      if (one(".__dimensions_badge_embed__"))
        run(
          () => load("js", { url: "https://badge.dimensions.ai/badge.js" }),
          () => window.__dimensions_embed?.addBadges?.(),
          one(".__dimensions_badge_embed__")
        );
    }
    if (enabled.has("research")) {
      const input = one("[data-research-search]");
      const papers = all("[data-research-paper]");
      const status = one("[data-research-status]");
      const empty = one("[data-research-empty]");
      if (input && status && empty) {
        const normalize = (value) =>
          value
            .toLocaleLowerCase(document.documentElement.lang || "en")
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "");
        const text = new Map(papers.map((paper) => [paper, normalize(paper.textContent)]));
        const apply = () => {
          const query = normalize(input.value.trim());
          let count = 0;
          papers.forEach((paper) => {
            paper.hidden = !text.get(paper).includes(query);
            if (!paper.hidden) count++;
          });
          all("[data-research-year]").forEach((heading) => {
            heading.hidden = !papers.some((paper) => paper.dataset.year === heading.dataset.researchYear && !paper.hidden);
          });
          all("[data-research-group]").forEach((group) => {
            group.hidden = ![...group.querySelectorAll("[data-research-paper]")].some((paper) => !paper.hidden);
          });
          status.textContent = label(
            "research",
            count === 1 ? "result_singular" : "result_plural",
            count === 1 ? "{count} publication" : "{count} publications"
          ).replace("{count}", String(count));
          empty.hidden = count !== 0;
        };
        const disabled = input.disabled;
        input.disabled = false;
        listen(input, "input", apply);
        apply();
        cleanup(() => {
          input.disabled = disabled;
        });
      }
    }
    if (enabled.has("newsletter"))
      all("form[data-newsletter]").forEach((form) => {
        const input = form.querySelector('input[type="email"]');
        const button = form.querySelector('button[type="submit"]');
        const status = form.querySelector("[data-newsletter-status]");
        if (!input || !button || !status) return;
        let pending = false;
        let request;
        const initiallyDisabled = button.disabled;
        cleanup(() => {
          request?.abort();
          button.disabled = initiallyDisabled;
          form.removeAttribute("aria-busy");
        });
        listen(form, "submit", async (event) => {
          event.preventDefault();
          if (pending || !form.reportValidity()) return;
          const url = new URL(form.action);
          if (
            url.protocol !== "https:" ||
            url.origin !== "https://app.loops.so" ||
            url.username ||
            url.password ||
            !/^\/api\/newsletter-form\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)
          )
            return;
          pending = true;
          button.disabled = true;
          form.setAttribute("aria-busy", "true");
          status.textContent = label("newsletter", "subscribing", "Subscribing…");
          request = new AbortController();
          const timer = setTimeout(() => request.abort(), 12000);
          try {
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ email: input.value.trim(), userGroup: "" }),
              signal: request.signal,
            });
            if (!active()) return;
            if (!response.ok) throw new Error(response.status === 429 ? "rate_limit" : "error");
            status.textContent = label("newsletter", "success", "You are subscribed.");
            form.reset();
          } catch (error) {
            if (active())
              status.textContent =
                error.message === "rate_limit"
                  ? label("newsletter", "rate_limit", "Too many requests. Please try again later.")
                  : label("newsletter", "error", "Could not subscribe. Please try again.");
          } finally {
            clearTimeout(timer);
            pending = false;
            if (active()) {
              button.disabled = initiallyDisabled;
              form.removeAttribute("aria-busy");
            }
          }
        });
      });
  };
  document.addEventListener("portfolio:content-mounted", (event) => mount(event.detail?.scope, event.detail?.optionalFeatures, event.detail || {}));
  document.addEventListener("portfolio:content-unmounted", (event) => scopes.get(event.detail?.scope)?.dispose());
  const configNode = document.querySelector("[data-optional-features]");
  if (configNode && configNode.textContent.length <= 131072) {
    try {
      mount(document, JSON.parse(configNode.textContent));
    } catch {
      /* Malformed manifest leaves native source. */
    }
  }
  document
    .querySelectorAll("[data-overlay-body]")
    .forEach((scope) => mount(scope, scope.portfolioOptionalFeatures, { url: location.href, scrollContainer: scope }));
})();
