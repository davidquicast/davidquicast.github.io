/** Shared semantic editorial composition. See docs/pretext.md. */
import { clearCache, layout, layoutWithLines, prepareWithSegments, setLocale } from "@chenglou/pretext";

const records = new Map();
const pending = new Set();
// Browser-fit verification is cached by text/typography/width, never run on scroll.
const nativeFits = new Map();
const NATIVE_FIT_LIMIT = 384;
let frame = 0;
let preparations = 0;
let layouts = 0;
let nativeMeasurements = 0;
let locale = "";
const normalize = (text) => text.replace(/\s+/gu, " ").trim();

function invalidate() {
  clearCache();
  nativeFits.clear();
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
    nativeFits.clear();
    for (const record of records.values()) record.key = "";
  }
  // Read the whole batch before committing any widths or line spans. This avoids
  // forcing browser layout once for every editorial title in a list.
  const measurements = [...pending].map((record) => [record, inspect(record)]);
  pending.clear();
  const plans = measurements.map(([record, measurement]) => preparePlan(record, measurement)).filter(Boolean);
  verifyNativeFits(plans);
  for (const plan of plans) compose(plan);
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

function typography(style) {
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const spacing = Number.parseFloat(style.letterSpacing) || 0;
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
  const nativeStyle = {};
  for (const property of [
    "fontKerning",
    "fontVariant",
    "fontFeatureSettings",
    "fontVariationSettings",
    "fontOpticalSizing",
    "fontStretch",
    "wordSpacing",
    "wordBreak",
    "overflowWrap",
    "whiteSpace",
    "textTransform",
    "textIndent",
    "direction",
    "hyphens",
    "textWrap",
  ]) {
    nativeStyle[property] = style[property];
  }
  return {
    font,
    spacing,
    lineHeight,
    wordBreak: style.wordBreak,
    nativeStyle,
    styleKey: JSON.stringify([font, spacing, lineHeight, style.wordBreak, nativeStyle]),
  };
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
  // clientWidth rounds fractional columns to an integer. Recover the CSS layout
  // unit from the resolved, untransformed width so max-inline-size cannot clamp
  // a 177px model to a 176.65625px browser box after composition.
  const padding = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
  const borders = parseFloat(style.borderLeftWidth || 0) + parseFloat(style.borderRightWidth || 0);
  const resolved = parseFloat(style.width);
  const content = Number.isFinite(resolved)
    ? resolved - (style.boxSizing === "border-box" ? padding + borders : 0)
    : element.getBoundingClientRect().width - padding - borders;
  const available = Math.round(content * 64) / 64;
  if (available <= 0) return;
  const text = normalize(wrapper.textContent || "");
  if (!text) return;
  return { available, ...typography(style), text, language: element.closest("[lang]")?.lang || locale };
}

function preparePlan(record, measurement) {
  if (!measurement) return;
  const { element } = record;
  const { available, font, spacing, lineHeight, text, wordBreak, styleKey } = measurement;
  const key = JSON.stringify([text, font, spacing, locale, wordBreak]);
  const measurementKey = JSON.stringify([key, available, styleKey, element.dataset.pretext]);
  if (record.key === key && record.measurementKey === measurementKey) {
    record.dirty = false;
    return;
  }
  const plan = { record, measurement, key, measurementKey };
  try {
    if (record.key !== key || !record.prepared) {
      record.prepared = prepareWithSegments(text, font, {
        letterSpacing: spacing,
        wordBreak: wordBreak === "keep-all" ? "keep-all" : "normal",
      });
      record.key = key;
      preparations += 1;
    }
    plan.width = balancedWidth(record.prepared, available, lineHeight);
    plan.originalLines = layout(record.prepared, available, lineHeight).lineCount;
    plan.result = layoutWithLines(record.prepared, plan.width, lineHeight);
    layouts += 1;
  } catch (error) {
    plan.error = error;
  }
  return plan;
}

function nativeFitKey(measurement, width, balanced) {
  return JSON.stringify([
    measurement.text,
    measurement.font,
    measurement.spacing,
    measurement.lineHeight,
    measurement.nativeStyle,
    measurement.language,
    width,
    balanced ? "wrap" : measurement.nativeStyle.textWrap,
  ]);
}

function verifyNativeFits(plans) {
  // Canvas and Blink's paragraph shaper can differ at exact break thresholds,
  // especially when a line starts within a hyphenated word. Never invent a
  // count or widen the actual text box to hide that platform limit. One isolated
  // batch checks new signatures; all matching signatures reuse bounded results.
  const probes = new Map();
  for (const plan of plans) {
    if (plan.error) continue;
    for (const [width, balanced] of [
      [plan.measurement.available, false],
      [plan.width, true],
    ]) {
      const key = nativeFitKey(plan.measurement, width, balanced);
      if (nativeFits.has(key) || probes.has(key)) continue;
      const probe = document.createElement("div");
      Object.assign(probe.style, plan.measurement.nativeStyle, {
        font: plan.measurement.font,
        lineHeight: `${plan.measurement.lineHeight}px`,
        letterSpacing: `${plan.measurement.spacing}px`,
        boxSizing: "content-box",
        width: `${width}px`,
        margin: "0",
        padding: "0",
        border: "0",
      });
      // font shorthand resets variant/stretch; restore the actual separate CSS.
      Object.assign(probe.style, plan.measurement.nativeStyle);
      if (balanced) probe.style.textWrap = "wrap";
      probe.lang = plan.measurement.language;
      probe.textContent = plan.measurement.text;
      probes.set(key, { probe, lineHeight: plan.measurement.lineHeight });
    }
  }
  if (probes.size) {
    nativeMeasurements += probes.size;
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.inert = true;
    Object.assign(host.style, {
      position: "fixed",
      left: "-100000px",
      top: "0",
      width: "0",
      height: "0",
      visibility: "hidden",
      overflow: "hidden",
      contain: "strict",
      pointerEvents: "none",
    });
    host.append(...[...probes.values()].map(({ probe }) => probe));
    document.body.append(host);
    // Read every probe after the single write batch, before touching live text.
    for (const [key, { probe, lineHeight }] of probes)
      nativeFits.set(key, Math.max(1, Math.round(probe.getBoundingClientRect().height / lineHeight)));
    host.remove();
  }
  for (const plan of plans) {
    if (plan.error) continue;
    const original = nativeFits.get(nativeFitKey(plan.measurement, plan.measurement.available, false));
    const balanced = nativeFits.get(nativeFitKey(plan.measurement, plan.width, true));
    plan.nativeFit = { original, balanced };
  }
  while (nativeFits.size > NATIVE_FIT_LIMIT) nativeFits.delete(nativeFits.keys().next().value);
}

function nativeFallback(plan, reason, error = null) {
  const { record, measurement, key, measurementKey } = plan;
  const { element, wrapper } = record;
  const selection = saveSelection(wrapper);
  if (wrapper.children.length || wrapper.textContent !== measurement.text) wrapper.textContent = measurement.text;
  restoreSelection(wrapper, selection);
  for (const property of ["inline-size", "max-inline-size", "display", "vertical-align", "text-wrap"]) wrapper.style.removeProperty(property);
  element.dataset.pretextReady = error ? "fallback" : "native";
  element.dataset.pretextFallback = reason;
  delete element.dataset.pretextLines;
  delete element.dataset.pretextWidth;
  element.style.removeProperty("--pretext-lines");
  element.style.removeProperty("--pretext-height");
  if (error) record.prepared = null;
  record.key = key;
  record.text = measurement.text;
  record.measurementKey = measurementKey;
  record.styleKey = measurement.styleKey;
  record.mode = element.dataset.pretext;
  record.width = measurement.available;
  record.rendered = "";
  record.result = null;
  record.nativeFit = plan.nativeFit;
  record.fallbackReason = reason;
  record.dirty = false;
  record.error = error ? String(error) : null;
}

function compose(plan) {
  const { record, measurement, key, measurementKey, width, result } = plan;
  const { element, wrapper } = record;
  const { available, font, spacing, lineHeight, text, wordBreak } = measurement;
  if (plan.error) return nativeFallback(plan, "measurement-error", plan.error);
  if (
    plan.nativeFit.original !== plan.originalLines ||
    plan.nativeFit.balanced !== result.lineCount ||
    plan.nativeFit.original !== plan.nativeFit.balanced
  ) {
    nativeFallback(plan, "browser-line-fit");
    return;
  }
  try {
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
    record.styleKey = measurement.styleKey;
    record.width = available;
    record.result = result;
    record.measurementKey = measurementKey;
    record.mode = element.dataset.pretext;
    record.dirty = false;
    record.error = null;
    record.fallbackReason = null;
    record.nativeFit = plan.nativeFit;
    delete element.dataset.pretextFallback;
  } catch (error) {
    nativeFallback(plan, "measurement-error", error);
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
      changedStyle = typography(getComputedStyle(element)).styleKey !== record.styleKey;
    }
    if (
      current !== record.text ||
      (!record.result && !record.error && !record.fallbackReason) ||
      !record.key ||
      changedStyle ||
      element.dataset.pretext !== record.mode
    )
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
    nativeMeasurements,
    nativeFitCacheEntries: nativeFits.size,
    elements: [...records.values()].map(({ element, width, result, error, fallbackReason, nativeFit }) => ({
      tag: element.tagName,
      text: element.textContent,
      availableWidth: width,
      width: Number(element.dataset.pretextWidth),
      lines: result?.lineCount,
      height: result?.height,
      error,
      fallbackReason,
      nativeFit,
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
