import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const distDir = join(rootDir, "dist");
const assetFiles = ["styles.css", "script.js"];
const buildVersion = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(distDir, { recursive: true });

for (const file of assetFiles) {
  cpSync(join(rootDir, file), join(distDir, file));
}

const sourceHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const distHtml = sourceHtml
  .replace('href="styles.css"', `href="styles.css?v=${buildVersion}"`)
  .replace('src="script.js"', `src="script.js?v=${buildVersion}"`);

writeFileSync(join(distDir, "index.html"), distHtml, "utf8");
writeFileSync(join(distDir, "build-version.txt"), `${buildVersion}\n`, "utf8");

console.log("Built files:");
for (const file of ["index.html", ...assetFiles, "build-version.txt"]) {
  console.log(`- dist/${file}`);
}
