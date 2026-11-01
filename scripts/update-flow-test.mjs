import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "zh-CN" });
const page = await ctx.newPage();

// Phase 1: install OLD service worker (rr-v1.0.0)
await page.goto("http://localhost:4174/");
await page.waitForLoadState("load");
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await page.waitForTimeout(1500);
console.log("phase1 cache:", await page.evaluate(async () => (await caches.keys()).find((k) => k.startsWith("rr-"))));

// Phase 2: swap in the NEW sw.js (rr-v1.0.1) and rebuild — same origin, same context
execSync("git checkout HEAD -- public/sw.js && pnpm build", { cwd: process.cwd(), stdio: "pipe" });

// Reload: browser detects the byte-diff SW → updatefound → installed + controller → banner
await page.reload();
await page.waitForLoadState("load");
let banner = 0;
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(1000);
  banner = await page.locator("button", { hasText: "新版本已就绪" }).count();
  if (banner === 1) break;
}
console.log("update banner:", banner === 1 ? "APPEARED ✓" : "NOT FOUND");
if (banner === 1) {
  await page.locator("button", { hasText: "新版本已就绪" }).click();
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(3000);
  console.log("after apply caches:", await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("rr-")).join(",")));
}
await browser.close();
console.log("UPDATE FLOW TEST DONE");
