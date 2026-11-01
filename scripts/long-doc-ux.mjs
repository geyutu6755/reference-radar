import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
const std = readFileSync("_research/real-docx/gbt7714-2025-standard.docx");
await page.goto("http://localhost:4173/");
await page.setInputFiles('input[type="file"]', { name: "standard.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: std });
await page.waitForSelector(".rr-wb", { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: "docs/screenshots/v11-longdoc-groups.png" });
// expand first group, click an issue inside
const summary = page.locator(".rr-group__summary").first();
await summary.click(); // collapse
await page.waitForTimeout(200);
await summary.click(); // expand
await page.waitForTimeout(200);
await page.locator(".rr-group .rr-issue").first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: "docs/screenshots/v11-longdoc-locate.png" });
console.log("long-doc UX shots done");
await browser.close();
