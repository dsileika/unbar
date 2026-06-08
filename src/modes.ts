// Shared mode definitions, imported by both the content script and the popup.
//
//   id    – stable key stored in chrome.storage
//   label – shown in the toaster and popup
//   fit   – CSS object-fit value ("" = leave untouched)
//   crop  – how to compute the bar-removing transform:
//             "cover"   – scale up uniformly until the picture covers the box
//             "stretch" – scale X and Y independently to fill (distorts)
//             "smart"   – auto, by the video's real aspect ratio + fill slider
//             null      – no scaling; object-fit alone
//   extra – multiply the computed cover scale for an extra zoom-in

export type Fit = "" | "contain" | "cover" | "fill";
export type Crop = null | "cover" | "stretch" | "smart";

export interface Mode {
  id: string;
  label: string;
  fit: Fit;
  crop: Crop;
  extra: number;
}

export const MODES: Mode[] = [
  { id: "off", label: "Off", fit: "", crop: null, extra: 1 },
  { id: "smart", label: "Smart (Auto)", fit: "", crop: "smart", extra: 1 },
  { id: "fit", label: "Fit", fit: "contain", crop: null, extra: 1 },
  { id: "fill", label: "Fill (Crop)", fit: "cover", crop: "cover", extra: 1 },
  { id: "stretch", label: "Stretch", fit: "fill", crop: "stretch", extra: 1 },
  { id: "zoom", label: "Zoom +15%", fit: "cover", crop: "cover", extra: 1.15 },
  { id: "zoomx", label: "Zoom +35%", fit: "cover", crop: "cover", extra: 1.35 },
];

export const DEFAULT_MODE = "off";

export function byId(id: string): Mode {
  return MODES.find((m) => m.id === id) || MODES[0];
}

export function indexOf(id: string): number {
  const i = MODES.findIndex((m) => m.id === id);
  return i < 0 ? 0 : i;
}

// Step through the list, clamping at the ends so Ctrl+Scroll feels natural.
export function step(id: string, delta: number): string {
  const i = indexOf(id);
  const next = Math.min(MODES.length - 1, Math.max(0, i + delta));
  return MODES[next].id;
}
