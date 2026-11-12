/* Build static CV pages and accessible text from the real source PDF. */
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const execute = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const settings = { version: 2, widths: [800, 1600], webp: "lossless", extraction: "layout" };
const digest = (data) => crypto.createHash("sha256").update(data).digest("hex");
async function run(command, args) {
  try {
    return await execute(command, args, { encoding: "utf8", maxBuffer: 12 * 1024 * 1024, env: { ...process.env, LC_ALL: "C.UTF-8" } });
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`CV preview requires ${command}. Use the project Docker image with poppler-utils and ImageMagick.`);
    throw error;
  }
}
async function version(command, flag) {
  const result = await run(command, [flag]);
  return (result.stdout || result.stderr).trim().split("\n")[0];
}
async function buildResumePreview({ root = projectRoot, force = false, lang = "en-us" } = {}) {
  const relSource = lang === "es" ? "assets/pdf/es/cv.pdf" : "assets/pdf/en-us/cv.pdf";
  const source = path.join(root, relSource);
  const manifest = path.join(root, lang === "es" ? "_data/resume_preview_es.json" : "_data/resume_preview.json");
  const output = path.join(root, lang === "es" ? "assets/img/resume/es" : "assets/img/resume/en-us");
  const bytes = await fsp.readFile(source);
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("CV source is not a PDF.");
  const sourceHash = digest(bytes);
  let previous;
  try {
    previous = JSON.parse(await fsp.readFile(manifest, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
  if (
    !force &&
    Array.isArray(previous?.pages) &&
    previous.pages.every((page) => Array.isArray(page.variants) && typeof page.text === "string") &&
    previous?.source?.sha256 === sourceHash &&
    JSON.stringify(previous.settings) === JSON.stringify(settings)
  ) {
    let intact = previous.pages.length > 0;
    for (const page of previous.pages)
      for (const image of page.variants) {
        try {
          intact &&= digest(await fsp.readFile(path.join(root, image.src))) === image.sha256;
        } catch (error) {
          if (error.code === "ENOENT") intact = false;
          else throw error;
        }
      }
    if (intact) return { changed: false, data: previous };
  }
  const privateRoot = path.join(root, ".local/redesign/profile-shell/cv-preview");
  await fsp.mkdir(privateRoot, { recursive: true });
  const temporary = await fsp.mkdtemp(path.join(privateRoot, "render-"));
  try {
    const snapshot = path.join(temporary, "source.pdf");
    await fsp.writeFile(snapshot, bytes);
    const info = (await run("pdfinfo", [snapshot])).stdout;
    const count = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!Number.isInteger(count) || count < 1) throw new Error("Cannot determine the CV page count.");
    const extracted = (await run("pdftotext", ["-layout", "-enc", "UTF-8", snapshot, "-"])).stdout;
    const textPages = extracted
      .split("\f")
      .slice(0, count)
      .map((text) =>
        text
          .split("\n")
          .map((line) => line.trim().replace(/[ \t]+/g, " "))
          .join("\n")
          .trim()
      );
    if (!textPages.join("").trim()) throw new Error("CV PDF has no extractable text; supply an accessible PDF before updating its preview.");
    const rasters = new Map();
    for (const width of settings.widths) {
      await run("pdftoppm", ["-scale-to-x", String(width), "-scale-to-y", "-1", "-png", snapshot, path.join(temporary, `render-${width}`)]);
      const pattern = new RegExp(`^render-${width}-(\\d+)\\.png$`);
      const files = (await fsp.readdir(temporary))
        .filter((name) => pattern.test(name))
        .sort((a, b) => Number(a.match(pattern)[1]) - Number(b.match(pattern)[1]));
      if (files.length !== count) throw new Error("CV raster page count differs from the actual PDF.");
      rasters.set(width, files);
    }
    await fsp.mkdir(output, { recursive: true });
    const pages = [];
    for (let index = 0; index < count; index++) {
      const variants = [];
      for (const width of settings.widths) {
        const converted = path.join(temporary, `page-${index + 1}-${width}.webp`);
        await run("convert", [
          path.join(temporary, rasters.get(width)[index]),
          "-strip",
          "-define",
          "webp:lossless=true",
          "-define",
          "webp:method=6",
          converted,
        ]);
        const image = await fsp.readFile(converted),
          hash = digest(image);
        const dimensions = (await run("identify", ["-format", "%w %h", converted])).stdout.trim().split(" ").map(Number);
        const filename = `cv-page-${index + 1}-${width}-${hash.slice(0, 12)}.webp`;
        await fsp.rename(converted, path.join(output, filename));
        variants.push({
          src: `/assets/img/resume/${lang}/${filename}`,
          width: dimensions[0],
          height: dimensions[1],
          bytes: image.length,
          sha256: hash,
        });
      }
      const image = variants[variants.length - 1];
      pages.push({
        number: index + 1,
        image,
        variants,
        srcset: variants.map((item) => `${item.src} ${item.width}w`).join(", "),
        text: textPages[index] || "",
      });
    }
    const data = {
      source: { path: `/${relSource}`, sha256: sourceHash, bytes: bytes.length },
      settings,
      tools: {
        pdftoppm: await version("pdftoppm", "-v"),
        pdftotext: await version("pdftotext", "-v"),
        imagemagick: await version("convert", "-version"),
      },
      page_count: count,
      pages,
    };
    await fsp.mkdir(path.dirname(manifest), { recursive: true });
    const staged = manifest + ".tmp";
    await fsp.writeFile(staged, await require("prettier").format(JSON.stringify(data), { parser: "json", printWidth: 150 }));
    await fsp.rename(staged, manifest);
    const keep = new Set(pages.flatMap((page) => page.variants.map((image) => path.basename(image.src))));
    for (const filename of await fsp.readdir(output))
      if (/^cv-page-\d+-(800|1600)-[a-f0-9]{12}\.webp$/.test(filename) && !keep.has(filename)) await fsp.unlink(path.join(output, filename));
    return { changed: true, data };
  } finally {
    await fsp.rm(temporary, { recursive: true, force: true });
  }
}
function watchResumePreview({ root = projectRoot, onChange = () => {}, onError = console.error } = {}) {
  let timer,
    pending = false,
    active = false;
  const refresh = async () => {
    if (active) {
      pending = true;
      return;
    }
    active = true;
    do {
      pending = false;
      try {
        const result = await buildResumePreview({ root });
        if (result.changed) onChange(result.data);
      } catch (error) {
        onError(error);
      }
    } while (pending);
    active = false;
  };
  const watcher = fs.watch(path.join(root, "assets/pdf/en-us"), (_event, filename) => {
    if (filename && filename.toString() !== "cv.pdf") return;
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  });
  return {
    close: () => {
      clearTimeout(timer);
      watcher.close();
    },
  };
}
module.exports = { buildResumePreview, watchResumePreview };
if (require.main === module) {
  const force = process.argv.includes("--force");
  const specificLang = process.argv.find((arg) => arg.startsWith("--lang="))?.split("=")[1];
  const languages = specificLang ? [specificLang] : ["en-us", "es"];
  (async () => {
    for (const lang of languages) {
      const { changed, data } = await buildResumePreview({ force, lang });
      console.log(`CV preview [${lang}] ${changed ? "generated" : "current"}: ${data.page_count} pages, ${data.source.sha256}`);
    }
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
