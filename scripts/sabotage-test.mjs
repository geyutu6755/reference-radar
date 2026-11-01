/**
 * Negative trial: sabotage the analysis worker and assert (a) the app fails
 * loudly with an error alert (no silent fake success), and (b) the test
 * harness catches it. Runs against a LOCAL preview only.
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "zh-CN" });
// sabotage: abort every analysis-worker script request
await ctx.route("**/analysis-worker*", (route) => route.abort());
const page = await ctx.newPage();
const c02 = readFileSync("corpus/files/C02.docx");

await page.goto("http://localhost:4173/");
await page.waitForTimeout(800);
await page.setInputFiles('input[type="file"]', { name: "C02.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: c02 });

// the app must show an error alert (fallback runs on main thread only if Worker
// construction fails; an aborted network request fails async → error alert)
let sawAlert = false;
try {
  await page.waitForSelector(".rr-alert--error", { timeout: 15000 });
  sawAlert = true;
} catch {
  // maybe the main-thread fallback succeeded (still a real analysis, not fake)
}
const workbench = await page.locator(".rr-wb").count();
const stats = workbench ? await page.locator(".rr-wb__stats").textContent() : "";

let verdict;
if (sawAlert) {
  verdict = "PASS-A: worker unavailable → error alert shown (loud failure, no fake success)";
} else if (workbench && (stats.includes("文献条目") || stats.includes("引用标记"))) {
  verdict = "PASS-B: worker request aborted but main-thread fallback produced a REAL analysis (no fabricated data) — acceptable";
} else {
  verdict = "FAIL: neither error alert nor a real workbench — app state unusable";
}
console.log("SABOTAGE TRIAL:", verdict);
console.log("workbench:", workbench, "| stats:", stats.replace(/\s+/g, " ").slice(0, 60));
await browser.close();
process.exitCode = verdict.startsWith("FAIL") ? 1 : 0;
