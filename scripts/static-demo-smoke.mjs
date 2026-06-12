#!/usr/bin/env node
import { createServer } from "node:http";
import { existsSync, statSync, createReadStream, readFileSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(rootDir, "apps", "web", "dist");
const indexPath = resolve(distDir, "index.html");
const notFoundPath = resolve(distDir, "404.html");
const basePath = "/sui-paylink";

if (!isReadableFile(indexPath)) {
  throw new Error(`Missing static demo index at ${indexPath}. Run npm run build:static-demo first.`);
}
if (!isReadableFile(notFoundPath)) {
  throw new Error(`Missing GitHub Pages fallback at ${notFoundPath}.`);
}

const indexHtml = readFileSync(indexPath, "utf8");
if (!indexHtml.includes(`${basePath}/assets/`)) {
  throw new Error(`Static demo assets are not built with ${basePath}/ base path.`);
}

const server = createServer((request, response) => {
  const pathname = pathnameForRequest(request.url ?? "/");
  const assetPath = assetPathForPathname(pathname);
  const filePath = assetPath && isInsideDist(assetPath) && isReadableFile(assetPath) ? assetPath : indexPath;
  response.writeHead(200, { "content-type": contentTypeFor(filePath) });
  createReadStream(filePath).pipe(response);
});

try {
  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not resolve local smoke server address");
  }
  const baseUrl = `http://127.0.0.1:${address.port}${basePath}`;

  const root = await expectOk(`${baseUrl}/`);
  expectIncludes(root, '<div id="root"></div>', "root html");

  const paylink = await expectOk(`${baseUrl}/pay/demo-ai-workflow`);
  expectIncludes(paylink, '<div id="root"></div>', "paylink fallback html");

  const assetHref = indexHtml.match(/\/sui-paylink\/assets\/[^"]+\.js/)?.[0];
  if (!assetHref) {
    throw new Error("Could not find built JS asset in static demo HTML");
  }
  await expectOk(`http://127.0.0.1:${address.port}${assetHref}`);

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    checked: ["index", "paylink-fallback", "asset-base-path", "github-pages-404"],
  }, null, 2));
} finally {
  await close(server);
}

function pathnameForRequest(rawUrl) {
  const pathname = new URL(rawUrl, "http://localhost").pathname;
  if (!pathname.startsWith(`${basePath}/`) && pathname !== basePath) {
    return "/";
  }
  const stripped = pathname.slice(basePath.length);
  return stripped || "/";
}

function assetPathForPathname(pathname) {
  try {
    return resolve(distDir, `.${decodeURIComponent(pathname)}`);
  } catch {
    return undefined;
  }
}

function isInsideDist(filePath) {
  const relativePath = relative(distDir, filePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function isReadableFile(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function contentTypeFor(filePath) {
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
  };
  return contentTypes[extname(filePath)] ?? "application/octet-stream";
}

async function listen(target) {
  await new Promise((resolveListen, rejectListen) => {
    target.once("error", rejectListen);
    target.listen(0, "127.0.0.1", () => {
      target.off("error", rejectListen);
      resolveListen();
    });
  });
}

async function close(target) {
  await new Promise((resolveClose, rejectClose) => {
    target.close((error) => {
      if (error) {
        rejectClose(error);
      } else {
        resolveClose();
      }
    });
  });
}

async function expectOk(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

function expectIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label} did not include ${expected}`);
  }
}
