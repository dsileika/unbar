// Build clean per-browser folders under dist/ from the TypeScript source.
// esbuild bundles src/content.ts and src/popup.ts into readable IIFE files
// (modes.ts is bundled into each). Static assets and the right manifest are
// copied alongside. No minification — output stays inspectable.
import { build } from "esbuild";
import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(root, "dist");

const TARGETS = {
  chrome: "manifest.json",
  firefox: "manifest.firefox.json",
};
const STATIC = ["content.css", "popup.html"];

async function run() {
  await rm(outRoot, { recursive: true, force: true });

  for (const [target, manifest] of Object.entries(TARGETS)) {
    const dir = path.join(outRoot, target);
    await mkdir(dir, { recursive: true });

    await build({
      entryPoints: {
        content: path.join(root, "src/content.ts"),
        popup: path.join(root, "src/popup.ts"),
      },
      outdir: dir,
      bundle: true,
      format: "iife",
      target: "es2020",
      charset: "utf8",
      legalComments: "none",
      logLevel: "warning",
    });

    for (const f of STATIC) await copyFile(path.join(root, f), path.join(dir, f));
    await cp(path.join(root, "icons"), path.join(dir, "icons"), { recursive: true });
    await copyFile(path.join(root, manifest), path.join(dir, "manifest.json"));
  }

  console.log("Built:");
  console.log("  dist/chrome   → load in Brave/Chrome (Load unpacked)");
  console.log("  dist/firefox  → load in Firefox (about:debugging → Load Temporary Add-on)");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
