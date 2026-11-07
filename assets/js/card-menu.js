/* Contextual card actions: native popovers with a keyboard-safe fallback. */
(() => {
  "use strict";
  const mountedMenus = new Map();
  let active = null;
  let sequence = 0;
  let resizeFrame = 0;
  const pending = new WeakMap();
  const ui = (() => {
    try {
      return JSON.parse(document.getElementById("portfolio-ui")?.textContent || "{}");
    } catch {
      return {};
    }
  })();
  const text = (key, fallback) => (typeof ui.card_menu?.[key] === "string" ? ui.card_menu[key] : fallback);
  const visible = (element) =>
    element.isConnected &&
    !element.closest("[hidden],[inert]") &&
    (!element.checkVisibility || element.checkVisibility()) &&
    getComputedStyle(element).visibility !== "hidden";
  const items = (record) => [...record.panel.querySelectorAll('a[href],button:not(:disabled),[role="menuitem"][tabindex]')].filter(visible);
  const focus = (element) => {
    if (element && visible(element)) element.focus({ preventScroll: true });
  };
  const restoreLabels = (record) => {
    record.panel.querySelectorAll("[data-copy-link]").forEach((button) => {
      pending.delete(button);
      button.disabled = false;
      button.removeAttribute("aria-busy");
      delete button.dataset.copyState;
      const label = button.querySelector("[data-copy-label]") || button;
      if (record.copyLabels.has(button)) label.textContent = record.copyLabels.get(button);
    });
    record.status.textContent = "";
  };
  const position = (record) => {
    if (!record.open) return;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth;
    const height = viewport?.height || innerHeight;
    const panel = record.panel;
    panel.style.maxWidth = `${Math.max(0, width - 16)}px`;
    panel.style.maxHeight = `${Math.max(0, height - 16)}px`;
    const anchor = record.trigger.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const x = Math.min(Math.max(left + 8, anchor.right - box.width), Math.max(left + 8, left + width - box.width - 8));
    const below = anchor.bottom + 6;
    const preferred = below + box.height <= top + height - 8 ? below : anchor.top - box.height - 6;
    const y = Math.min(Math.max(top + 8, preferred), Math.max(top + 8, top + height - box.height - 8));
    panel.style.left = `${Math.round(x)}px`;
    panel.style.top = `${Math.round(y)}px`;
  };
  const close = (record, returnFocus = false) => {
    if (!record?.open) return;
    record.open = false;
    if (active === record) active = null;
    record.trigger.setAttribute("aria-expanded", "false");
    if (record.native) {
      try {
        if (record.panel.matches(":popover-open")) record.panel.hidePopover();
      } catch {}
    }
    record.panel.hidden = true;
    record.panel.querySelectorAll('[role="menuitem"]').forEach((item) => {
      item.tabIndex = -1;
    });
    restoreLabels(record);
    if (returnFocus) focus(record.trigger);
  };
  const open = (record, last = false) => {
    if (active && active !== record) close(active);
    restoreLabels(record);
    record.open = true;
    active = record;
    record.trigger.setAttribute("aria-expanded", "true");
    record.panel.hidden = false;
    if (record.native) {
      try {
        record.panel.showPopover();
      } catch {
        record.native = false;
        record.panel.removeAttribute("popover");
        document.body.append(record.panel);
        record.panel.hidden = false;
      }
    } else record.panel.hidden = false;
    position(record);
    const options = items(record);
    const selected = last ? options.at(-1) : options[0];
    options.forEach((option) => {
      option.tabIndex = option === selected ? 0 : -1;
    });
    focus(selected);
  };
  const safeCopyURL = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const canonical = document.querySelector('link[rel="canonical"]')?.href;
      const base = canonical && /^https?:/.test(canonical) ? canonical : location.href;
      const url = new URL(value, base);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
      const allowed = new Set([location.origin, new URL(base).origin]);
      return allowed.has(url.origin) ? url.href : null;
    } catch {
      return null;
    }
  };
  const copy = async (button, record) => {
    const url = safeCopyURL(button.dataset.url || record.trigger.dataset.url);
    if (!url) {
      button.dataset.copyState = "error";
      record.status.textContent = text("unavailable", "This link is unavailable.");
      position(record);
      return;
    }
    const ticket = Symbol("copy");
    pending.set(button, ticket);
    const hadFocus = document.activeElement === button;
    const label = button.querySelector("[data-copy-label]") || button;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    label.textContent = text("copying", "Copying…");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      if (pending.get(button) !== ticket || active !== record) return;
      button.dataset.copyState = "copied";
      label.textContent = text("copied", "Link copied");
      record.status.textContent = text("success", "Link copied to clipboard.");
    } catch {
      if (pending.get(button) !== ticket || active !== record) return;
      button.dataset.copyState = "error";
      label.textContent = text("retry", "Try copying again");
      record.status.textContent = text("error", "Copy failed. Open the page and copy its address, or try again.");
    } finally {
      if (pending.get(button) === ticket) {
        pending.delete(button);
        button.disabled = false;
        button.removeAttribute("aria-busy");
        if (active === record) {
          position(record);
          if (hadFocus && (!document.activeElement || document.activeElement === document.body)) focus(button);
        }
      }
    }
  };
  const tabDestination = (trigger, backward) => {
    const candidates = [...document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")].filter(
      (element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[data-card-menu-panel]") && visible(element)
    );
    const index = candidates.indexOf(trigger);
    return candidates[index + (backward ? -1 : 1)] || trigger;
  };

  const register = (scope) =>
    scope.querySelectorAll("button[data-card-menu]").forEach((trigger) => {
      if (mountedMenus.has(trigger)) return;
      const controlled = trigger.getAttribute("aria-controls");
      const panel = (controlled && document.getElementById(controlled)) || trigger.nextElementSibling;
      if (!(panel instanceof HTMLElement) || !panel.matches("[data-card-menu-panel]")) return;
      if (!trigger.id) trigger.id = `card-menu-button-${++sequence}`;
      if (!panel.id) panel.id = `card-menu-panel-${++sequence}`;
      trigger.setAttribute("aria-controls", panel.id);
      trigger.setAttribute("aria-haspopup", "menu");
      trigger.setAttribute("aria-expanded", "false");
      panel.setAttribute("role", "menu");
      panel.setAttribute("aria-labelledby", trigger.id);
      Object.assign(panel.style, { position: "fixed", inset: "auto", margin: "0", boxSizing: "border-box", overflowY: "auto" });
      let status = panel.querySelector("[data-card-menu-status]");
      if (!status) {
        status = document.createElement("p");
        status.dataset.cardMenuStatus = "";
        status.className = "card-menu-status";
        panel.append(status);
      }
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      const record = {
        trigger,
        panel,
        status,
        open: false,
        native: typeof panel.showPopover === "function" && typeof panel.hidePopover === "function",
        copyLabels: new Map(),
      };
      mountedMenus.set(trigger, record);
      panel.querySelectorAll("a[href],button").forEach((item) => {
        item.setAttribute("role", "menuitem");
        item.tabIndex = -1;
      });
      panel.querySelectorAll("[data-copy-link]").forEach((button) => {
        record.copyLabels.set(button, (button.querySelector("[data-copy-label]") || button).textContent);
      });
      panel.querySelectorAll("a[data-lightbox]").forEach((link) => {
        link.dataset.lightboxReturnFocus = trigger.id;
      });
      if (record.native) {
        panel.popover = "auto";
        panel.hidden = true;
      } else {
        panel.hidden = true;
        document.body.append(panel);
      }
      panel.addEventListener("toggle", (event) => {
        if (event.newState !== "closed" || !record.open) return;
        record.open = false;
        panel.hidden = true;
        if (active === record) active = null;
        trigger.setAttribute("aria-expanded", "false");
        restoreLabels(record);
      });
      trigger.hidden = false;
      trigger.disabled = false;
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        record.open ? close(record, true) : open(record);
      });
      trigger.addEventListener("keydown", (event) => {
        if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        open(record, event.key === "ArrowUp");
      });
      panel.addEventListener("click", (event) => {
        const button = event.target.closest?.("button[data-copy-link]");
        if (button && panel.contains(button)) {
          event.preventDefault();
          event.stopPropagation();
          copy(button, record);
        } else if (event.target.closest?.("a[href]")) close(record);
      });
      panel.addEventListener("keydown", (event) => {
        const options = items(record);
        const current = options.indexOf(document.activeElement);
        let target;
        if (event.key === "ArrowDown") target = options[(current + 1) % options.length];
        else if (event.key === "ArrowUp") target = options[(current - 1 + options.length) % options.length];
        else if (event.key === "Home") target = options[0];
        else if (event.key === "End") target = options.at(-1);
        else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close(record, true);
          return;
        } else if (event.key === "Tab") {
          event.preventDefault();
          const destination = tabDestination(trigger, event.shiftKey);
          close(record);
          focus(destination);
          return;
        }
        if (target) {
          event.preventDefault();
          event.stopPropagation();
          options.forEach((option) => {
            option.tabIndex = option === target ? 0 : -1;
          });
          focus(target);
        }
      });
    });
  register(document);
  document.addEventListener("portfolio:content-mounted", (event) => {
    if (event.detail?.scope) register(event.detail.scope);
  });
  document.addEventListener("portfolio:content-unmounted", (event) => {
    const scope = event.detail?.scope;
    if (!(scope instanceof Element)) return;
    for (const [trigger, record] of mountedMenus)
      if (scope.contains(trigger)) {
        close(record);
        restoreLabels(record);
        record.panel.remove();
        mountedMenus.delete(trigger);
      }
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (active && !active.panel.contains(event.target) && !active.trigger.contains(event.target)) close(active);
    },
    true
  );
  document.addEventListener("focusin", (event) => {
    if (active && !active.panel.contains(event.target) && !active.trigger.contains(event.target)) close(active);
  });
  document.addEventListener(
    "scroll",
    (event) => {
      if (active && !active.panel.contains(event.target)) close(active);
    },
    true
  );
  const resize = () => {
    if (active && !resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        if (active) position(active);
      });
  };
  addEventListener("resize", resize, { passive: true });
  window.visualViewport?.addEventListener("resize", resize, { passive: true });
  const check = () => {
    if (active && !visible(active.trigger)) close(active);
  };
  document.addEventListener("portfolio:filter", check);
  document.addEventListener("portfolio:content-updated", check);
  addEventListener("pagehide", () => {
    if (active) close(active);
  });
})();
