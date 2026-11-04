/**
 * Minimal static server that emulates GitHub Pages project-site behavior:
 * serves ./dist under the /reference-radar/ prefix with correct MIME types,
 * trailing-slash directory index, and no SPA rewrites (404 for missing files).
 * Usage: node scripts/serve-dist-subpath.mjs [port]
 */
import { createServer } from "node:http";
import { statSync, readFileSync, existsSync } from "node:fs";
import { join, extname, normalize } from "node:path";

const PORT = Number(process.argv[2] ?? 4176);
const PREFIX = "/reference-radar/";
const ROOT = join(process.cwd(), "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".otf": "font/otf",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

createServer((req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://x");
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith(PREFIX)) {
      res.writeHead(404).end("not under prefix");
      return;
    }
    let rel = pathname.slice(PREFIX.length);
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(500).end();
  }
}).listen(PORT, () => console.log(`serving dist at http://localhost:${PORT}${PREFIX}`));
