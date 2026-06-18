#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(rootDir, "apps", "web", "dist");
const indexPath = resolve(distDir, "index.html");
const notFoundPath = resolve(distDir, "404.html");
const demoRouteIndexPaths = [
  resolve(distDir, "create", "index.html"),
  resolve(distDir, "pay", "demo-ai-workflow", "index.html"),
  resolve(distDir, "buyer", "demo-ai-workflow", "index.html"),
  resolve(distDir, "seller", "demo-ai-workflow", "index.html"),
];

if (!isReadableFile(indexPath)) {
  throw new Error(`Missing static demo index at ${indexPath}. Build the web app first.`);
}

copyFileSync(indexPath, notFoundPath);
for (const routeIndexPath of demoRouteIndexPaths) {
  mkdirSync(dirname(routeIndexPath), { recursive: true });
  copyFileSync(indexPath, routeIndexPath);
}

console.log(JSON.stringify({
  ok: true,
  files: [
    relativeToDist(notFoundPath),
    ...demoRouteIndexPaths.map(relativeToDist),
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
