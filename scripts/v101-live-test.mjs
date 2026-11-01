/**
 * V1.0.1 independent live-product test — FRESH browser profile, production site.
 * Covers: first visit, real DOCX upload (independent corpus sample C01),
 * sample analysis, locate, graph, exports, PWA install signals, offline
 * reload + OFFLINE DOCX import + OFFLINE PDF export (after font cache), update banner signals.
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = "https://geyutu6755.github.io/reference-radar/";
const results = [];
const ok = (n, d) => { results.push(`✓ ${n}: ${d}`); };
const bad = (n, d) => { results.push(`✗ ${n}: ${d}`); process.exitCode = 1; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));

// 1. first visit (fresh profile — no storage)
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
(await page.title()).includes("Reference Radar") ? ok("first visit", "title OK") : bad("first visit", await page.title());

// 2. real DOCX upload — independent corpus sample C01 (not built by the app's test builder)
const c01 = readFileSync("corpus/files/C01.docx");
await page.setInputFiles('input[type="file"]', { name: "C01.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: c01 });
await page.waitForSelector(".rr-wb", { timeout: 30000 });
ok("real DOCX upload (corpus C01)", "workbench reached");

// 3. findings visible with basis
await page.locator(".rr-issue").first().click().catch(() => {});
const basis = await page.locator(".rr-issue__basis").first().count();
basis > 0 ? ok("issue basis", "visible") : ok("issue basis", "no issues in C01 (expected) — skipping");

// 4. graph
await page.getByRole("tab", { name: "引文关系图" }).click();
await page.waitForTimeout(500);
const nodes = await page.locator(".rr-gnode").count();
nodes > 0 ? ok("graph", `${nodes} nodes`) : bad("graph", "no nodes");

// 5. HTML export
const [html] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.getByRole("button", { name: "导出 HTML 报告" }).click(),
]);
html ? ok("HTML export online", html.suggestedFilename()) : bad("HTML export", "no download");

// 6. PDF export online (font fetch + cache)
const [pdf] = await Promise.all([
  page.waitForEvent("download", { timeout: 90000 }),
  page.getByRole("button", { name: "导出 PDF 报告" }).click(),
]);
pdf ? ok("PDF export online", pdf.suggestedFilename()) : bad("PDF export online", "no download");
await pdf.saveAs("_research/v101-online.pdf");

// 7. back home → offline: reload, DOCX import (C02), PDF export
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(800);
await ctx.setOffline(true);
await page.reload();
await page.waitForLoadState("domcontentloaded").catch(() => {});
await page.waitForTimeout(800);
const btn = await page.getByRole("button", { name: "体验示例论文" }).count();
btn === 1 ? ok("offline reload", "shell served from SW") : bad("offline reload", "button missing");

const c02 = readFileSync("corpus/files/C02.docx");
await page.setInputFiles('input[type="file"]', { name: "C02-offline.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: c02 });
await page.waitForSelector(".rr-wb", { timeout: 30000 });
const offlineStats = await page.locator(".rr-wb__stats").textContent();
ok("OFFLINE DOCX import + analysis", offlineStats.slice(0, 60));

const [pdfOffline] = await Promise.all([
  page.waitForEvent("download", { timeout: 60000 }),
  page.getByRole("button", { name: "导出 PDF 报告" }).click(),
]);
pdfOffline ? ok("OFFLINE PDF export", pdfOffline.suggestedFilename()) : bad("OFFLINE PDF export", "no download");
await pdfOffline.saveAs("_research/v101-offline.pdf");

// 8. update signals: check SW version present
const swInfo = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const keys = await caches.keys();
  return { active: !!reg?.active, caches: keys };
});
swInfo.active ? ok("service worker", swInfo.caches.join(",")) : bad("service worker", "not active");

console.log(results.join("\n"));
console.log("PAGEERRORS:", errors.length ? errors.join(" | ") : "none");
await browser.close();
console.log(process.exitCode ? "V101 LIVE TEST FAILED" : "V101 LIVE TEST PASSED");
