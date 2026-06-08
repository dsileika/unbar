// web-ext configuration (auto-loaded from the project root).
// The source is the built Firefox folder produced by build.sh, so always run
// `npm run build` first (the npm scripts do this for you).
module.exports = {
  sourceDir: "./dist/firefox",
  artifactsDir: "./dist/artifacts",
  build: {
    overwriteDest: true,
  },
  run: {
    // Handy default page to test against; override with `web-ext run --start-url`.
    startUrl: ["https://www.youtube.com"],
  },
};
