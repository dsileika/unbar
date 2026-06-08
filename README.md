<p align="center">
  <img src="assets/banner.png" alt="Unbar — remove the black bars from any video" width="640">
</p>

<p align="center">
  <b>Crop, zoom, stretch or auto-fit any video to remove black bars — on ultrawide or any screen.</b><br>
  A tiny, dependency-free browser extension for Chromium (Brave / Chrome / Edge) and Firefox.
</p>

<p align="center">
  <a href="https://github.com/dsileika/unbar/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/dsileika/unbar/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-6c8cff">
  <img alt="Chromium + Firefox" src="https://img.shields.io/badge/browsers-Chromium%20%7C%20Firefox-6c8cff">
  <img alt="No tracking" src="https://img.shields.io/badge/data%20collected-none-3fbf7f">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue">
</p>

---

Black bars happen when a video's aspect ratio doesn't match your screen —
a 16:9 clip on a 21:9 ultrawide, a 4:3 video on a 16:9 laptop, and so on.
**Unbar** makes the picture fill the player, with one click or one scroll, on
any site. No accounts, no servers, **nothing leaves your browser**.

## Features

- **Smart (Auto)** — reads each video's true aspect ratio and the player size,
  then zooms exactly enough to fill. A **fill-strength slider** (with reset)
  blends smoothly from original to fully filled; it won't gut portrait clips.
- **7 modes** — Off · Smart · Fit (contain) · Fill/Crop (cover) · Stretch ·
  Zoom +15% · Zoom +35%.
- **Ctrl + Scroll** to cycle modes — active only in fullscreen or over the
  video; normal page zoom is untouched everywhere else.
- **On-screen toaster** showing the selected mode, visible even in fullscreen.
- **Works everywhere** — every site and inside cross-origin `<iframe>` players,
  re-applied as videos load (SPA sites like YouTube).
- **Per-site overrides** — flip *Only this site* to pin a mode for one site
  (e.g. crop on YouTube, off elsewhere); other sites follow the global default.

## Modes

| Mode | What it does |
|------|--------------|
| **Off** | Original video, untouched |
| **Smart (Auto)** | Auto-zooms to fill by the video's real aspect ratio (slider-controlled) |
| **Fit** | `object-fit: contain` — whole picture, bars kept |
| **Fill (Crop)** | Zoom-to-cover — crops the overflow so bars disappear |
| **Stretch** | Fills exactly by distorting (no crop) |
| **Zoom +15% / +35%** | Cover plus extra crop for stubborn bars |

## Install

Grab a prebuilt zip from the [**Releases**](https://github.com/dsileika/unbar/releases)
page — `unbar-chrome-<ver>.zip` or `unbar-firefox-<ver>.zip` — so you don't have
to build anything. Or build locally with `./build.sh` (same code, both browsers;
only the manifest differs). Unpack the zip, then follow the steps below.

### Brave / Chrome / Edge

1. Open `brave://extensions` (or `chrome://extensions`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select the unzipped `unbar-chrome-<ver>` folder
   (or `dist/chrome` if you built locally).
4. Pin the extension and open any video (e.g. YouTube).

### Firefox

1. Run `./build.sh` (creates `dist/firefox` with the Gecko manifest).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select
   `dist/firefox/manifest.json`.
4. Open any video and try it.

> Temporary add-ons are removed when Firefox restarts. To install permanently
> you'd package and sign it via [AMO](https://addons.mozilla.org) or
> `web-ext sign`. The `browser_specific_settings.gecko.id` is already set.

## Development (web-ext)

[`web-ext`](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
is wired up for the Firefox build. Install deps once with `npm install`, then:

| Script | What it does |
|--------|--------------|
| `npm run build` | Generate `dist/chrome` and `dist/firefox` |
| `npm run lint` | Build, then `web-ext lint` the Firefox package (0 warnings) |
| `npm start` | Build, then launch Firefox with the add-on auto-loaded + live reload |
| `npm run dist` | Build, then package `dist/artifacts/unbar-<version>.zip` |
| `npm run sign` | Build, then sign via AMO for self-distribution (unlisted) |

`web-ext` config lives in `web-ext-config.cjs` (source dir, artifacts dir).

- **`npm start`** needs a Firefox binary; if it's not on `PATH`, pass one with
  `web-ext run --firefox /path/to/firefox` (or `--firefox=nightly`).
- **`npm run sign`** needs AMO API credentials — set `WEB_EXT_API_KEY` and
  `WEB_EXT_API_SECRET` (from <https://addons.mozilla.org/developers/addon/api/key/>)
  in your environment first.

## Usage

- Hold **Ctrl** and **scroll** with the pointer over a video to change modes,
  or click the toolbar icon and pick a mode.
- "Fill (Crop)" is the classic ultrawide fix: it crops letterbox/pillarbox
  bars so the picture fills the player.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest (Chromium) |
| `manifest.firefox.json` | MV3 manifest (Firefox/Gecko) |
| `build.sh` | Writes `dist/chrome` and `dist/firefox` |
| `package.json` | npm scripts wrapping `web-ext` |
| `web-ext-config.cjs` | `web-ext` source/artifacts config |
| `modes.js` | Shared mode definitions |
| `content.js` | Applies modes, Ctrl+Scroll handler, toaster |
| `content.css` | Toaster styling |
| `popup.html` / `popup.js` | Toolbar popup UI |
| `icons/` | Extension icons |
| `assets/` | README banner & logo (not shipped in the build) |

## How it works

Each `<video>` exposes its true content size (`videoWidth`/`videoHeight`); the
extension measures the player box and applies `object-fit` and a `transform:
scale` to fill it, recomputing on resize, fullscreen, quality changes, and SPA
navigations. It never touches `width`/`height`/`left`/`top`, so the video can't
collapse. Mode and per-site settings live in `chrome.storage.local`, which every
frame (and the popup) reads as the single source of truth.

## Privacy

Unbar collects nothing and talks to no server. The only stored data is your
chosen mode, per-site overrides, and Smart fill strength — kept locally in the
browser via `chrome.storage.local`.

## License

[MIT](LICENSE). This is an independent, original project — not affiliated with
or derived from any commercial extension.
