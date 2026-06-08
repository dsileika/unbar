// Unbar — content script.
// Applies the selected video mode, listens for Ctrl+Scroll to switch modes,
// and shows a brief toaster with the active mode.
import { byId, step, DEFAULT_MODE, type Mode } from "./modes";

const STYLE_FLAG = "data-unbar";
// One global mode, shared across every frame and site via chrome.storage.
// storage is the single source of truth: the popup and Ctrl+Scroll both just
// write it, and every frame reacts to the change (applies + toasts). This
// avoids cross-frame races and works inside cross-origin <iframe> players.
const KEY = "mode"; // global default mode
const SITES_KEY = "sites"; // { [origin]: modeId } per-site overrides
const FILL_KEY = "fillStrength"; // Smart 0..1: 0 = original, 1 = full fill
const DEFAULT_FILL = 1;

// Webkit-prefixed fullscreen members aren't in the standard DOM types.
const doc = document as Document & {
  webkitFullscreenElement?: Element | null;
};

// The site this frame belongs to (the top-level page, even inside cross-origin
// iframes, via ancestorOrigins). Per-site overrides are keyed by this so an
// embedded player follows the same override as the page hosting it.
const SITE: string = (() => {
  try {
    if (window.top === window.self) return location.origin;
    const a = location.ancestorOrigins;
    if (a && a.length) return a[a.length - 1];
  } catch (_) {}
  return location.origin;
})();

let globalMode = DEFAULT_MODE; // applies to sites without an override
let siteMode: string | null = null; // this site's override, or null to follow global
let currentMode = DEFAULT_MODE; // the effective mode actually applied
let fillStrength = DEFAULT_FILL; // how far Smart zooms from original to full

const effectiveMode = (): string => siteMode || globalMode;

// ---- styling ---------------------------------------------------------------

interface DesiredStyle {
  fit: string;
  transform: string;
}

// Properties we override so we can cleanly restore them on "off".
const MANAGED = ["object-fit", "transform", "transform-origin"];

// The box the video should fill: the fullscreen element if any, else the
// video's own player container. Climb out of wrappers that hug the video so
// we measure the element that actually has the black bars around it.
function fillBox(video: HTMLVideoElement): Element {
  const fs = doc.fullscreenElement || doc.webkitFullscreenElement;
  if (fs) return fs;
  let el: Element | null = video.parentElement;
  let box: Element | null = el;
  // Walk up a few levels, preferring the largest sensible ancestor.
  for (let i = 0; el && i < 4; i++) {
    if (el.clientWidth > ((box && box.clientWidth) || 0)) box = el;
    el = el.parentElement;
  }
  return box || video.parentElement || document.documentElement;
}

// Smallest uniform scale that makes the video's box cover the fill box.
function coverScale(video: HTMLVideoElement, box: Element, extra: number): number {
  const vw = video.clientWidth, vh = video.clientHeight;
  const cw = box.clientWidth, ch = box.clientHeight;
  if (!vw || !vh || !cw || !ch) return 1;
  return Math.max(1, Math.max(cw / vw, ch / vh) * (extra || 1));
}

// Smart/Auto: read the video's true content aspect and the box it lives in,
// then zoom partway from original toward full fill, controlled by the
// fillStrength slider. 0 = original (bars), 1 = bars fully gone. Every value
// in between is a real partial zoom. object-fit:contain is the baseline so
// strength 0 shows the whole picture; we cap the zoom so extreme mismatches
// (e.g. a portrait clip on a wide screen) don't explode at 100%.
const MAX_FILL_ZOOM = 3;
function smartStyle(video: HTMLVideoElement, box: Element): DesiredStyle {
  const cw = box.clientWidth, ch = box.clientHeight;
  const cvw = video.videoWidth, cvh = video.videoHeight;
  if (!cw || !ch || !cvw || !cvh) return { fit: "", transform: "" }; // metadata not ready
  const contentAR = cvw / cvh;
  const boxAR = cw / ch;
  // Zoom needed to fully cover = how mismatched the two aspect ratios are.
  const zFull = Math.min(
    MAX_FILL_ZOOM,
    Math.max(contentAR, boxAR) / Math.min(contentAR, boxAR)
  );
  if (zFull <= 1.01) return { fit: "", transform: "" }; // already fits
  const s = 1 + fillStrength * (zFull - 1); // interpolate original → full fill
  return { fit: "contain", transform: s > 1.005 ? `scale(${s.toFixed(4)})` : "" };
}

// Resolve the desired { object-fit, transform } for a mode + video.
function desiredStyle(video: HTMLVideoElement, mode: Mode): DesiredStyle {
  const box = fillBox(video);
  if (mode.crop === "smart") return smartStyle(video, box);
  if (mode.crop === "stretch") {
    const vw = video.clientWidth, vh = video.clientHeight;
    const cw = box.clientWidth, ch = box.clientHeight;
    const transform = vw && vh && cw && ch
      ? `scale(${(cw / vw).toFixed(4)}, ${(ch / vh).toFixed(4)})`
      : "";
    return { fit: mode.fit || "", transform };
  }
  if (mode.crop === "cover") {
    const s = coverScale(video, box, mode.extra);
    return { fit: mode.fit || "", transform: s > 1.01 ? `scale(${s.toFixed(4)})` : "" };
  }
  return { fit: mode.fit || "", transform: "" }; // fit / no-crop modes
}

// Idempotent: only writes when the desired value differs, so the style-attr
// observer below can call this freely without looping on our own mutations.
function styleVideo(video: HTMLVideoElement, mode: Mode): void {
  if (mode.id === "off") {
    MANAGED.forEach((p) => video.style.removeProperty(p));
    video.removeAttribute(STYLE_FLAG);
    return;
  }
  // We never touch width/height/left/top — forcing those can collapse the
  // video to 0 on containers with no fixed height. transform:scale enlarges
  // the element to cover the player and crops the overflow (the "upscale"
  // trick); object-fit controls how the picture sits inside the element.
  const { fit, transform } = desiredStyle(video, mode);
  if (video.style.objectFit !== fit) {
    if (fit) video.style.setProperty("object-fit", fit, "important");
    else video.style.removeProperty("object-fit");
  }
  if (transform) {
    if (video.style.transformOrigin !== "center center") {
      video.style.setProperty("transform-origin", "center center", "important");
    }
    if (video.style.transform !== transform) {
      video.style.setProperty("transform", transform, "important");
    }
  } else if (video.style.transform) {
    video.style.removeProperty("transform");
  }
  video.setAttribute(STYLE_FLAG, mode.id);
  watch(video);
}

function applyToAll(mode: Mode): void {
  document.querySelectorAll("video").forEach((v) => styleVideo(v, mode));
}

// YouTube (and others) rewrite the video's inline style on resize / quality /
// ad transitions, and the fill scale depends on live geometry — so re-run
// styleVideo on every style mutation. It's idempotent, so this won't loop.
const watched = new WeakSet<HTMLVideoElement>();
function watch(video: HTMLVideoElement): void {
  if (watched.has(video)) return;
  watched.add(video);
  const mo = new MutationObserver(() => {
    const mode = byId(currentMode);
    if (mode.id !== "off") styleVideo(video, mode);
  });
  mo.observe(video, { attributes: true, attributeFilter: ["style"] });
}

// Geometry changes (window resize, entering/leaving fullscreen, theater mode)
// change the cover scale; recompute for all videos.
let raf = 0;
function reapply(): void {
  if (currentMode === "off") return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => applyToAll(byId(currentMode)));
}
window.addEventListener("resize", reapply);
document.addEventListener("fullscreenchange", reapply);
document.addEventListener("webkitfullscreenchange", reapply);

// ---- toaster ---------------------------------------------------------------

let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;

function showToast(text: string): void {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "unbar-toast";
  }
  // In fullscreen only the fullscreen element's subtree renders, so the
  // toaster must live inside it; otherwise put it on <body>.
  const host: Element =
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    document.body ||
    document.documentElement;
  if (toastEl.parentNode !== host) host.appendChild(toastEl);
  toastEl.textContent = "Unbar: " + text;
  toastEl.classList.add("unbar-toast--visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (toastEl) toastEl.classList.remove("unbar-toast--visible");
  }, 1200);
}

// ---- mode changes ----------------------------------------------------------

// Writes are scoped: if this site has an override, the change updates the
// override; otherwise it updates the global default. The storage.onChanged
// handler below does the actual applying/toasting from one source of truth.
function setMode(id: string): void {
  if (siteMode != null) setSiteMode(id);
  else chrome.storage.local.set({ [KEY]: id });
}

function setSiteMode(id: string): void {
  chrome.storage.local.get(SITES_KEY, (res) => {
    const sites = (res[SITES_KEY] || {}) as Record<string, string>;
    sites[SITE] = id;
    chrome.storage.local.set({ [SITES_KEY]: sites });
  });
}

// Recompute the effective mode from current global + site override and apply
// it if it changed.
function refresh(opts: { toast?: boolean } = {}): void {
  const next = effectiveMode();
  if (next === currentMode) return;
  currentMode = next;
  applyToAll(byId(next));
  // Toast only in frames that actually contain a video, so the message shows
  // over the real player (incl. inside iframes / fullscreen) and empty frames
  // don't flash an invisible toast.
  if (opts.toast && document.querySelector("video")) showToast(byId(next).label);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[FILL_KEY]) {
    fillStrength = clampFill(changes[FILL_KEY].newValue);
    // Re-fit live if Smart mode is active and the strength moved.
    if (currentMode === "smart") applyToAll(byId("smart"));
  }
  if (changes[KEY]) globalMode = changes[KEY].newValue || DEFAULT_MODE;
  if (changes[SITES_KEY]) {
    const sites = (changes[SITES_KEY].newValue || {}) as Record<string, string>;
    siteMode = Object.prototype.hasOwnProperty.call(sites, SITE) ? sites[SITE] : null;
  }
  if (changes[KEY] || changes[SITES_KEY]) refresh({ toast: true });
});

function clampFill(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_FILL;
}

// ---- Ctrl+Scroll -----------------------------------------------------------

// Find the video the pointer is acting on, or null to let the page handle the
// scroll (normal Ctrl+Scroll zoom). In fullscreen the player fills the screen,
// so any position counts; otherwise the cursor must be over a video's box.
// Using geometry (not e.target) means overlays/controls on top don't block it.
function videoForWheel(x: number, y: number): HTMLVideoElement | null {
  const fs = doc.fullscreenElement || doc.webkitFullscreenElement;
  if (fs) return fs.matches("video") ? (fs as HTMLVideoElement) : fs.querySelector("video");
  for (const v of document.querySelectorAll("video")) {
    const r = v.getBoundingClientRect();
    if (r.width && r.height && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      return v;
    }
  }
  return null;
}

function onWheel(e: WheelEvent): void {
  if (!e.ctrlKey) return;
  // Only act in fullscreen or over the video player; elsewhere leave the
  // browser's native Ctrl+Scroll zoom untouched.
  if (!videoForWheel(e.clientX, e.clientY)) return;
  e.preventDefault();
  e.stopPropagation();
  // Scroll up = next (more aggressive) mode, down = previous.
  const delta = e.deltaY < 0 ? 1 : -1;
  const next = step(currentMode, delta);
  if (next !== currentMode) setMode(next);
  else showToast(byId(currentMode).label); // clamped at the end
}

// passive:false so preventDefault() actually blocks page zoom/scroll.
window.addEventListener("wheel", onWheel, { passive: false, capture: true });

// ---- keep new / re-rendered videos in sync ---------------------------------

const observer = new MutationObserver((mutations) => {
  const mode = byId(currentMode);
  if (mode.id === "off") return;
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.tagName === "VIDEO") styleVideo(node as HTMLVideoElement, mode);
      else node.querySelectorAll("video").forEach((v) => styleVideo(v, mode));
    }
  }
});

// Re-apply when a video loads or its intrinsic size becomes known/changes.
// 'loadedmetadata'/'resize' carry videoWidth/videoHeight — exactly what Smart
// mode needs to read the true aspect ratio. 'loadeddata' covers SPA swaps that
// wipe inline styles (YouTube etc.).
function onVideoLoad(e: Event): void {
  const t = e.target;
  if (t instanceof HTMLVideoElement && currentMode !== "off") {
    styleVideo(t, byId(currentMode));
  }
}
["loadedmetadata", "loadeddata", "resize"].forEach((ev) =>
  document.addEventListener(ev, onVideoLoad, true)
);

// ---- init ------------------------------------------------------------------

chrome.storage.local.get([KEY, SITES_KEY, FILL_KEY], (res) => {
  if (res[FILL_KEY] != null) fillStrength = clampFill(res[FILL_KEY]);
  globalMode = res[KEY] || DEFAULT_MODE;
  const sites = (res[SITES_KEY] || {}) as Record<string, string>;
  siteMode = Object.prototype.hasOwnProperty.call(sites, SITE) ? sites[SITE] : null;
  currentMode = effectiveMode();
  if (currentMode !== "off") applyToAll(byId(currentMode));
  observer.observe(document.documentElement, { childList: true, subtree: true });
});
