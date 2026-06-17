#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(rootDir, "apps", "web", "dist");
const indexPath = resolve(distDir, "index.html");
const notFoundPath = resolve(distDir, "404.html");
const demoRouteDir = resolve(distDir, "pay", "demo-ai-workflow");
const demoRouteIndexPath = resolve(demoRouteDir, "index.html");

if (!isReadableFile(indexPath)) {
  throw new Error(`Missing static demo index at ${indexPath}. Build the web app first.`);
}

copyFileSync(indexPath, notFoundPath);
mkdirSync(demoRouteDir, { recursive: true });
copyFileSync(indexPath, demoRouteIndexPath);

console.log(JSON.stringify({
  ok: true,
  files: [
    relativeToDist(notFoundPath),
    relativeToDist(demoRouteIndexPath),
  ],
}, null, 2));

function isReadableFile(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function relativeToDist(filePath) {
  return filePath.replace(`${distDir}/`, "");
}
