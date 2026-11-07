/** Shared semantic editorial composition. See docs/pretext.md. */
import { clearCache, layout, layoutWithLines, prepareWithSegments, setLocale } from "@chenglou/pretext";

const records = new Map();
const pending = new Set();
let frame = 0;
let preparations = 0;
let layouts = 0;
let locale = "";
const normalize = (text) => text.replace(/\s+/gu, " ").trim();

function invalidate() {
  clearCache();
  for (const record of records.values()) {
    record.key = "";
    queue(record);
  }
}

function queue(record) {
  record.dirty = true;
  pending.add(record);
  if (!frame) frame = requestAnimationFrame(flush);
}

function flush() {
  frame = 0;
  const nextLocale = document.documentElement.lang || "en";
  if (nextLocale !== locale) {
    locale = nextLocale;
    setLocale(locale);
    for (const record of records.values()) record.key = "";
  }
  // Read the whole batch before committing any widths or line spans. This avoids
  // forcing browser layout once for every editorial title in a list.
  const measurements = [...pending].map((record) => [record, inspect(record)]);
  pending.clear();
  for (const [record, measurement] of measurements) compose(record, measurement);
}

/** Search the narrowest width retaining the browser's original line count. */
export function balancedWidth(prepared, available, lineHeight) {
  const original = layout(prepared, available, lineHeight);
  if (original.lineCount < 2) return available;
  let low = available * 0.48;
  let high = available;
  for (let i = 0; i < 14; i += 1) {
    const middle = (low + high) / 2;
    if (layout(prepared, middle, lineHeight).lineCount > original.lineCount) low = middle;
    else high = middle;
  }
  // A small safety margin accounts for browser subpixel rounding.
  return Math.min(available, Math.ceil(high + 1));
}

function inspect(record) {
  const { element, wrapper } = record;
  if (!element.isConnected) {
    discard(record);
    return;
  }
  if (element.closest("[hidden]")) return;
  const style = getComputedStyle(element);
  if (style.display === "none") return;
  const available = element.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
  if (available <= 0) return;
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const spacing = Number.parseFloat(style.letterSpacing) || 0;
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
  const text = normalize(wrapper.textContent || "");
  if (!text) return;
  return { available, font, spacing, lineHeight, text, wordBreak: style.wordBreak };
}

function compose(record, measurement) {
  if (!measurement) return;
  const { element, wrapper } = record;
  const { available, font, spacing, lineHeight, text, wordBreak } = measurement;
  const key = JSON.stringify([text, font, spacing, locale, wordBreak]);
  const measurementKey = JSON.stringify([key, available, lineHeight, element.dataset.pretext]);
  if (record.key === key && record.measurementKey === measurementKey) {
    record.dirty = false;
    return;
  }
  try {
    if (record.key !== key || !record.prepared) {
      record.prepared = prepareWithSegments(text, font, {
        letterSpacing: spacing,
        wordBreak: wordBreak === "keep-all" ? "keep-all" : "normal",
      });
      record.key = key;
      record.text = text;
      preparations += 1;
    }
    const width = balancedWidth(record.prepared, available, lineHeight);
    const result = layoutWithLines(record.prepared, width, lineHeight);
    layouts += 1;
    wrapper.style.inlineSize = `${width}px`;
    wrapper.style.maxInlineSize = "100%";
    wrapper.style.display = "inline-block";
    wrapper.style.verticalAlign = "top";
    wrapper.style.textWrap = "wrap";
    // Animated manual lines only when materialization retains the exact content.
    // Long unbroken tokens retain native browser wrapping instead.
    const lines = result.lines.map((line) => line.text.trim());
    const manualLines = element.dataset.pretext === "lines" && lines.join(" ") === text;
    const signature = JSON.stringify([manualLines, lines]);
    if (record.rendered !== signature) {
      const selection = saveSelection(wrapper);
      if (manualLines) {
        const fragment = document.createDocumentFragment();
        lines.forEach((line, index) => {
          const span = document.createElement("span");
          span.className = "pretext-line";
          span.style.setProperty("--line-index", index);
          span.textContent = line + (index < lines.length - 1 ? " " : "");
          fragment.append(span);
        });
        wrapper.replaceChildren(fragment);
      } else if (wrapper.children.length || wrapper.textContent !== text) wrapper.textContent = text;
      restoreSelection(wrapper, selection);
      record.rendered = signature;
    }
    element.dataset.pretextReady = "true";
    element.dataset.pretextLines = String(result.lineCount);
    element.dataset.pretextWidth = String(width);
    element.style.setProperty("--pretext-lines", result.lineCount);
    element.style.setProperty("--pretext-height", `${result.height}px`);
    record.styleKey = JSON.stringify([font, spacing, lineHeight, wordBreak]);
    record.width = available;
    record.result = result;
    record.measurementKey = measurementKey;
    record.mode = element.dataset.pretext;
    record.dirty = false;
    record.error = null;
  } catch (error) {
    // Cache this failed signature as native text. Repeated observer callbacks
    // must not turn a missing Canvas context into an animation-frame retry loop.
    const selection = saveSelection(wrapper);
    if (wrapper.children.length || wrapper.textContent !== text) wrapper.textContent = text;
    restoreSelection(wrapper, selection);
    wrapper.style.removeProperty("inline-size");
    element.dataset.pretextReady = "fallback";
    delete element.dataset.pretextLines;
    delete element.dataset.pretextWidth;
    element.style.removeProperty("--pretext-lines");
    element.style.removeProperty("--pretext-height");
    record.prepared = null;
    record.key = key;
    record.text = text;
    record.measurementKey = measurementKey;
    record.styleKey = JSON.stringify([font, spacing, lineHeight, wordBreak]);
    record.mode = element.dataset.pretext;
    record.rendered = "";
    record.result = null;
    record.dirty = false;
    record.error = String(error);
  }
}

function saveSelection(wrapper) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const point = (node, offset) => {
    if (!wrapper.contains(node)) return { node, offset };
    const range = document.createRange();
    range.selectNodeContents(wrapper);
    range.setEnd(node, offset);
    return { textOffset: range.toString().length };
  };
  if (!wrapper.contains(selection.anchorNode) && !wrapper.contains(selection.focusNode)) return null;
  return { anchor: point(selection.anchorNode, selection.anchorOffset), focus: point(selection.focusNode, selection.focusOffset) };
}

function restoreSelection(wrapper, saved) {
  if (!saved) return;
  const resolve = (point) => {
    if (point.node) return point;
    const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
    let remaining = point.textOffset;
    let last = null;
    while (walker.nextNode()) {
      last = walker.currentNode;
      if (remaining <= last.length) return { node: last, offset: remaining };
      remaining -= last.length;
    }
    return { node: last || wrapper, offset: last?.length || 0 };
  };
  const anchor = resolve(saved.anchor);
  const focus = resolve(saved.focus);
  if (anchor.node.isConnected && focus.node.isConnected)
    window.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
}

function discard(record, nativeFallback = false) {
  records.delete(record.element);
  pending.delete(record);
  resize.unobserve(record.element);
  if (!nativeFallback) return;
  const { element, wrapper } = record;
  if (element.contains(wrapper)) {
    const fragment = document.createDocumentFragment();
    for (const node of [...wrapper.childNodes]) {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("pretext-line")) fragment.append(...node.childNodes);
      else fragment.append(node);
    }
    wrapper.replaceWith(fragment);
  }
  element.dataset.pretextReady = "native";
  delete element.dataset.pretextLines;
  delete element.dataset.pretextWidth;
  element.style.removeProperty("--pretext-lines");
  element.style.removeProperty("--pretext-height");
}

function register(element) {
  if (records.has(element) || element.children.length || !normalize(element.textContent || "")) return;
  // Inline links can opt in; display:block makes the available column measurable.
  if (getComputedStyle(element).display === "inline") element.style.display = "block";
  const wrapper = document.createElement("span");
  wrapper.className = "pretext-composition";
  wrapper.textContent = normalize(element.textContent);
  element.replaceChildren(wrapper);
  const record = { element, wrapper, key: "", rendered: "", result: null };
  records.set(element, record);
  resize.observe(element);
  mutation.observe(element, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "lang", "data-pretext"],
  });
  queue(record);
}

const resize = new ResizeObserver((entries) => {
  for (const { target, contentRect } of entries) {
    const record = records.get(target);
    if (record && !target.isConnected) discard(record);
    else if (record && contentRect.width > 0 && (record.dirty || Math.abs(contentRect.width - (record.width || 0)) > 0.1)) queue(record);
  }
});
const mutation = new MutationObserver((entries) => {
  for (const { target } of entries) {
    const element = target.nodeType === Node.ELEMENT_NODE ? target.closest("[data-pretext]") : target.parentElement?.closest("[data-pretext]");
    const record = records.get(element);
    if (!record) continue;
    if (!element.contains(record.wrapper)) {
      if (element.children.length) {
        discard(record, true);
        continue;
      }
      record.wrapper.textContent = normalize(element.textContent || "");
      element.replaceChildren(record.wrapper);
      record.key = "";
    }
    if ([...record.wrapper.children].some((child) => !child.classList.contains("pretext-line") || child.children.length)) {
      discard(record, true);
      continue;
    }
    const current = normalize(record.wrapper.textContent || "");
    let changedStyle = false;
    if (target.nodeType === Node.ELEMENT_NODE && target === element) {
      const style = getComputedStyle(element);
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
      changedStyle = JSON.stringify([font, Number.parseFloat(style.letterSpacing) || 0, lineHeight, style.wordBreak]) !== record.styleKey;
    }
    if (current !== record.text || (!record.result && !record.error) || !record.key || changedStyle || element.dataset.pretext !== record.mode)
      queue(record);
  }
});

// Ancestor changes can alter inherited font metrics or reveal dirty text without
// changing the measured element's width. Ignore our own generated span/style
// writes, and batch affected descendants into the same read-before-write frame.
new MutationObserver((entries) => {
  // Feed positioning can write several styles on the same card in one task.
  // Search each affected subtree once instead of scanning all registered text
  // for every style mutation. Broader ancestors subsume their nested targets.
  const targets = new Set();
  for (const { target } of entries) {
    if (records.has(target) || target.closest?.(".pretext-composition")) continue;
    targets.add(target);
  }
  for (const target of targets) {
    let ancestor = target.parentElement;
    while (ancestor && !targets.has(ancestor)) ancestor = ancestor.parentElement;
    if (ancestor) continue;
    for (const element of target.querySelectorAll("[data-pretext]")) {
      const record = records.get(element);
      if (record) queue(record);
    }
  }
}).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "data-theme"] });

export async function initializePretext(scope = document) {
  await document.fonts.ready;
  scope.querySelectorAll("[data-pretext]").forEach(register);
}

// Diagnostics are deliberately read-only and contain no user information.
window.portfolioPretext = Object.freeze({
  refresh: () => {
    document.querySelectorAll("[data-pretext]").forEach(register);
    invalidate();
  },
  snapshot: () => ({
    version: "1.0.0",
    preparations,
    layouts,
    elements: [...records.values()].map(({ element, width, result, error }) => ({
      tag: element.tagName,
      text: element.textContent,
      availableWidth: width,
      width: Number(element.dataset.pretextWidth),
      lines: result?.lineCount,
      height: result?.height,
      error,
    })),
  }),
});
document.fonts.addEventListener("loadingdone", invalidate);
new MutationObserver(invalidate).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
window.addEventListener(
  "resize",
  () => {
    for (const record of records.values()) queue(record);
  },
  { passive: true }
);
window.addEventListener("portfolio:content-updated", () => initializePretext());
document.addEventListener("portfolio:content-updated", () => initializePretext());
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => initializePretext(), { once: true });
else initializePretext();

// Release detached reader targets explicitly; cached text preparations remain reusable.
document.addEventListener("portfolio:content-unmounted", (event) => {
  const scope = event.detail?.scope;
  if (!(scope instanceof Element)) return;
  for (const record of [...records.values()]) if (record.element === scope || scope.contains(record.element)) discard(record);
});
