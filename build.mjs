import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const distDir = join(rootDir, "dist");
const htmlFiles = ["index.html", "saved.html", "whisper.html", "moonshine.html"];
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

writeFileSync(join(distDir, "build-version.txt"), `${buildVersion}\n`, "utf8");

console.log("Built files:");
for (const file of [...htmlFiles, ...assetFiles, "build-version.txt"]) {
  console.log(`- dist/${file}`);
}
