import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const distDir = join(rootDir, "dist");
const htmlFiles = ["index.html", "saved.html", "speech.html"];
const assetFiles = ["styles.css", "storage.js", "script.js", "saved.js"];
const buildVersion = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(distDir, { recursive: true });

for (const file of assetFiles) {
  cpSync(join(rootDir, file), join(distDir, file));
}

for (const htmlFile of htmlFiles) {
  let sourceHtml = readFileSync(join(rootDir, htmlFile), "utf8");

  sourceHtml = sourceHtml.replaceAll('href="styles.css"', `href="styles.css?v=${buildVersion}"`);
  for (const assetFile of ["storage.js", "script.js", "saved.js"]) {
    sourceHtml = sourceHtml.replaceAll(`src="${assetFile}"`, `src="${assetFile}?v=${buildVersion}"`);
  }

  writeFileSync(join(distDir, htmlFile), sourceHtml, "utf8");
}

// Moonshine test page: its own folder so the COOP/COEP service worker only controls /moonshine/.
cpSync(join(rootDir, "moonshine"), join(distDir, "moonshine"), { recursive: true });
cpSync(join(rootDir, "sample_en.wav"), join(distDir, "moonshine", "sample_en.wav"));
const moonshineHtml = join(distDir, "moonshine", "index.html");
writeFileSync(
  moonshineHtml,
  readFileSync(moonshineHtml, "utf8").replaceAll('src="app.js"', `src="app.js?v=${buildVersion}"`),
  "utf8",
);

writeFileSync(join(distDir, "build-version.txt"), `${buildVersion}\n`, "utf8");

console.log("Built files:");
for (const file of [...htmlFiles, ...assetFiles, "moonshine/", "build-version.txt"]) {
  console.log(`- dist/${file}`);
}
