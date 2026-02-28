import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const distDir = join(rootDir, "dist");
const filesToCopy = ["index.html", "styles.css", "script.js"];

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(distDir, { recursive: true });

for (const file of filesToCopy) {
  cpSync(join(rootDir, file), join(distDir, file));
}

console.log("Built files:");
for (const file of filesToCopy) {
  console.log(`- dist/${file}`);
}
