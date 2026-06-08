// Shared mode definitions, used by both the content script and the popup.
// Each mode describes how to style a <video> element.
//
//   id      – stable key stored in chrome.storage
//   label   – shown in the toaster and popup
//   fit     – CSS object-fit value ('' = leave untouched)
//   scale   – optional extra transform scale on top of the fit
//
// "Fill (Crop)" is the classic ultrawide trick: object-fit:cover crops the
// letterbox/pillarbox bars so the picture fills the whole player.
(function (root) {
  // crop: how to compute the transform that removes black bars.
  //   "cover"   – scale up uniformly until the picture covers the container
  //               (crops the overflowing edge) — the classic "upscale" trick.
  //   "stretch" – scale X and Y independently to fill exactly (distorts).
  //   null      – no scaling; object-fit alone.
  // extra: multiply the computed cover scale for an extra zoom-in.
  const MODES = [
    { id: "off",     label: "Off",         fit: "",        crop: null,      extra: 1 },
    { id: "smart",   label: "Smart (Auto)", fit: "",       crop: "smart",   extra: 1 },
    { id: "fit",     label: "Fit",         fit: "contain", crop: null,      extra: 1 },
    { id: "fill",    label: "Fill (Crop)", fit: "cover",   crop: "cover",   extra: 1 },
    { id: "stretch", label: "Stretch",     fit: "fill",    crop: "stretch", extra: 1 },
    { id: "zoom",    label: "Zoom +15%",   fit: "cover",   crop: "cover",   extra: 1.15 },
    { id: "zoomx",   label: "Zoom +35%",   fit: "cover",   crop: "cover",   extra: 1.35 },
  ];

  const api = {
    MODES,
    DEFAULT_MODE: "off",
    byId(id) {
      return MODES.find((m) => m.id === id) || MODES[0];
    },
    indexOf(id) {
      const i = MODES.findIndex((m) => m.id === id);
      return i < 0 ? 0 : i;
    },
    // Step through the list, clamping at the ends so Ctrl+Scroll feels natural.
    step(id, delta) {
      const i = api.indexOf(id);
      const next = Math.min(MODES.length - 1, Math.max(0, i + delta));
      return MODES[next].id;
    },
  };

  root.UNBAR = api;
})(typeof window !== "undefined" ? window : globalThis);
