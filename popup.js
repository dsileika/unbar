// Unbar — popup.
// chrome.storage is the single source of truth: read it to highlight the active
// mode, write it to change modes. Content scripts in every frame react to the
// change. No tab messaging, so no cross-frame races.
//
// Scope: there's a global default mode plus optional per-site overrides
// (stored in `sites` keyed by origin). The toggle picks which one the mode
// buttons edit; the highlighted mode is always the effective one for this site.
(function () {
  const { UNBAR } = window;
  const KEY = "mode";
  const SITES_KEY = "sites";
  const FILL_KEY = "fillStrength";
  const DEFAULT_FILL = 1;

  const container = document.getElementById("modes");
  const fill = document.getElementById("fill");
  const fillVal = document.getElementById("fillVal");
  const fillReset = document.getElementById("fillReset");
  const siteToggle = document.getElementById("siteToggle");
  const siteHost = document.getElementById("siteHost");

  let globalMode = UNBAR.DEFAULT_MODE;
  let sites = {}; // { origin: modeId }
  let origin = null; // current tab's origin (per-site key)

  const hasOverride = () => origin && Object.prototype.hasOwnProperty.call(sites, origin);
  const effective = () => (hasOverride() ? sites[origin] : globalMode);

  // ---- Smart fill slider (global, stored as a 0..1 strength) ---------------
  function showFill(strength) {
    const pct = Math.round(strength * 100);
    fill.value = pct;
    fillVal.textContent = pct + "%";
  }
  function setFill(strength) {
    showFill(strength);
    chrome.storage.local.set({ [FILL_KEY]: strength });
  }
  fill.addEventListener("input", () => {
    fillVal.textContent = fill.value + "%";
    chrome.storage.local.set({ [FILL_KEY]: Number(fill.value) / 100 });
  });
  fillReset.addEventListener("click", () => setFill(DEFAULT_FILL));

  // ---- modes ---------------------------------------------------------------
  function render() {
    const active = effective();
    container.querySelectorAll("button.mode").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.id === active);
    });
    siteToggle.checked = hasOverride();
    siteToggle.disabled = !origin;
  }

  function selectMode(id) {
    if (hasOverride()) {
      sites = { ...sites, [origin]: id };
      chrome.storage.local.set({ [SITES_KEY]: sites });
    } else {
      globalMode = id;
      chrome.storage.local.set({ [KEY]: id });
    }
    render();
  }

  function build() {
    UNBAR.MODES.forEach((mode) => {
      const btn = document.createElement("button");
      btn.className = "mode";
      btn.dataset.id = mode.id;
      const label = document.createElement("span");
      label.textContent = mode.label;
      const check = document.createElement("span");
      check.className = "check";
      check.textContent = "✓";
      btn.append(label, check);
      btn.addEventListener("click", () => selectMode(mode.id));
      container.appendChild(btn);
    });
    render();
  }

  // ---- scope toggle --------------------------------------------------------
  // ON  → pin the current effective mode as this site's override.
  // OFF → drop the override so the site follows the global default again.
  siteToggle.addEventListener("change", () => {
    if (!origin) return;
    if (siteToggle.checked) {
      sites = { ...sites, [origin]: effective() };
    } else {
      sites = { ...sites };
      delete sites[origin];
    }
    chrome.storage.local.set({ [SITES_KEY]: sites });
    render();
  });

  // Keep the UI live if mode/site/fill change elsewhere (e.g. Ctrl+Scroll).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[KEY]) globalMode = changes[KEY].newValue || UNBAR.DEFAULT_MODE;
    if (changes[SITES_KEY]) sites = changes[SITES_KEY].newValue || {};
    if (changes[FILL_KEY]) showFill(Number(changes[FILL_KEY].newValue) || 0);
    if (changes[KEY] || changes[SITES_KEY]) render();
  });

  // ---- init ----------------------------------------------------------------
  build();
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs && tabs[0] && tabs[0].url;
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") {
        origin = u.origin;
        siteHost.textContent = u.hostname;
      } else {
        siteHost.textContent = "this page can't be modified";
      }
    } catch (_) {
      siteHost.textContent = "this page can't be modified";
    }
    chrome.storage.local.get([KEY, SITES_KEY, FILL_KEY], (res) => {
      globalMode = res[KEY] || UNBAR.DEFAULT_MODE;
      sites = res[SITES_KEY] || {};
      showFill(res[FILL_KEY] != null ? Number(res[FILL_KEY]) : DEFAULT_FILL);
      render();
    });
  });
})();
