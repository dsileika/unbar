#!/usr/bin/env bash
# Build clean per-browser folders under dist/. Each gets the shared source plus
# the right manifest, so neither browser warns about the other's manifest keys.
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
shared=(content.js content.css modes.js popup.html popup.js icons)

rm -rf "$root/dist"
for target in chrome firefox; do
  out="$root/dist/$target"
  mkdir -p "$out"
  for f in "${shared[@]}"; do cp -r "$root/$f" "$out/"; done
done
cp "$root/manifest.json"         "$root/dist/chrome/manifest.json"
cp "$root/manifest.firefox.json" "$root/dist/firefox/manifest.json"

echo "Built:"
echo "  dist/chrome   → load in Brave/Chrome (Load unpacked)"
echo "  dist/firefox  → load in Firefox (about:debugging → Load Temporary Add-on → manifest.json)"
