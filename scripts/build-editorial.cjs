const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const { buildResumePreview, watchResumePreview } = require("./build-resume-preview.cjs");

async function build() {
  await buildResumePreview();
  const root = path.resolve(__dirname, "..");
  const dist = path.join(root, "assets/js/dist");
  fs.mkdirSync(dist, { recursive: true });
  fs.copyFileSync(path.join(root, "node_modules/@chenglou/pretext/LICENSE"), path.join(dist, "editorial.LICENSE.txt"));
  const fonts = path.join(root, "assets/fonts/editorial");
  fs.mkdirSync(fonts, { recursive: true });
  for (const [font, weights] of [
    ["zilla-slab", [400, 600]],
    ["dm-sans", [400, 500, 600]],
    ["inter", [400, 500, 600, 700]],
  ]) {
    const source = path.join(root, "node_modules/@fontsource", font);
    fs.copyFileSync(path.join(source, "LICENSE"), path.join(fonts, font + "-LICENSE.txt"));
    for (const weight of weights) {
      const filename = `${font}-latin-${weight}-normal.woff2`;
      fs.copyFileSync(path.join(source, "files", filename), path.join(fonts, filename));
    }
  }
  const options = {
    absWorkingDir: root,
    entryPoints: ["assets/js/src/editorial.js"],
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2022",
    outfile: "assets/js/dist/editorial.js",
    banner: { js: "/*! Includes @chenglou/pretext 1.0.0, MIT. Full third-party notices: editorial.LICENSE.txt */" },
    logLevel: "info",
  };
  if (process.argv.includes("--watch")) {
    const context = await esbuild.context(options);
    await context.watch();
    watchResumePreview({
      onChange: () => console.log("[watch] CV preview updated"),
      onError: (error) => console.error("[watch] CV preview:", error.message),
    });
  } else await esbuild.build(options);
}
build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
