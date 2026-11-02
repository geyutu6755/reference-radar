/**
 * PWA update + offline verification (V1.1.1).
 *
 * Non-destructive by design: it serves the built dist, installs the worker, then
 * changes ONLY dist/sw.js — a gitignored build output — to a new version string,
 * reloads, and checks the whole update path. Nothing under version control is
 * touched, and dist/sw.js is restored on exit.
 *
 * Usage: pnpm build && node scripts/pwa-update-offline-check.mjs
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const PORT = Number(process.env.RR_PORT ?? 4179);
const BASE = `http://localhost:${PORT}/`;
const SW = resolve(process.cwd(), "dist/sw.js");
const CURRENT = "rr-v1.1.1";
const NEXT = "rr-v1.1.2";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn("pnpm", ["preview", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
  shell: true, // Windows: pnpm resolves to a .CMD shim that spawn() cannot exec directly
});

const original = readFileSync(SW, "utf-8");
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " :: " + detail : ""}`);
  if (!ok) failures++;
};

try {
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    up = await fetch(BASE)
      .then((r) => r.ok)
      .catch(() => false);
    if (!up) await sleep(500);
  }
  if (!up) throw new Error(`preview server never answered on port ${PORT}`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "zh-CN" });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 160)));

  await page.goto(BASE, { waitUntil: "load" });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await sleep(2500);

  const cachesAfterInstall = await page.evaluate(async () =>
    (await caches.keys()).filter((k) => k.startsWith("rr-"))
  );
  check("install precaches under the current version", cachesAfterInstall.includes(`${CURRENT}-precache`), cachesAfterInstall.join(","));

  const shellCached = await page.evaluate(
    async (name) => {
      const c = await caches.open(name);
      return (await c.match("./")) || (await c.match("./index.html")) ? 1 : 0;
    },
    `${CURRENT}-precache`
  );
  check("app shell is in the precache", shellCached === 1);

  const assetCount = await page.evaluate(async (name) => {
    const c = await caches.open(name);
    return (await c.keys()).length;
  }, `${CURRENT}-precache`);
  check("precache holds the generated asset list", assetCount > 8, `${assetCount} entries`);

  // Publish a new version by changing only the served worker script.
  const bumped = original.replace(`const VERSION = "${CURRENT}"`, `const VERSION = "${NEXT}"`);
  check(`version string "${CURRENT}" present to bump`, bumped !== original);
  writeFileSync(SW, bumped, "utf-8");

  await page.reload({ waitUntil: "load" });
  let banner = 0;
  for (let i = 0; i < 15 && banner === 0; i++) {
    await sleep(1000);
    banner = await page.locator("button", { hasText: "新版本已就绪" }).count();
  }
  check("update banner appears for returning installs", banner === 1);
  if (banner === 1) {
    await page.locator("button", { hasText: "新版本已就绪" }).click();
    await page.waitForLoadState("load").catch(() => {});
    await sleep(3000);
  }

  const cachesAfterUpdate = await page.evaluate(async () =>
    (await caches.keys()).filter((k) => k.startsWith("rr-"))
  );
  check(
    "caches migrate to the new version",
    cachesAfterUpdate.some((k) => k.startsWith(NEXT)),
    cachesAfterUpdate.join(",")
  );
  check(
    "the previous version's cache is then evicted",
    !cachesAfterUpdate.some((k) => k.startsWith(CURRENT)),
    cachesAfterUpdate.join(",")
  );

  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "体验示例论文" }).click();
  await page.waitForSelector(".rr-wb", { timeout: 25000 });
  const stats = await page.locator(".rr-wb__stats").textContent();
  check("offline analysis works after the update", /引用标记/.test(stats ?? ""), (stats ?? "").replace(/\s+/g, " ").slice(0, 60));

  const [html] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("button", { name: "导出 HTML 报告" }).click(),
  ]);
  check("offline HTML export works", /\.html$/.test(html.suggestedFilename()));

  check("no page errors across install, update and offline", pageErrors.length === 0, pageErrors.join(" | "));
  await browser.close();
} finally {
  writeFileSync(SW, original, "utf-8");
  server.kill("SIGTERM");
}

console.log(failures === 0 ? "PWA CHECK: ALL PASS" : `PWA CHECK: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
