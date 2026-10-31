import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const BASE = "http://localhost:4173/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
const page = await ctx.newPage();
// build the sample paper DOCX via the page's own builder? simpler: reconstruct via engine-agnostic path:
// Use the sample flow and download the HTML report; and craft a .docx sample file locally.
await page.goto(BASE);
await page.getByRole("button", { name: "体验示例论文" }).click();
await page.waitForSelector(".rr-wb", { timeout: 20000 });
const [html] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.getByRole("button", { name: "导出 HTML 报告" }).click(),
]);
await html.saveAs("release-assets/示例论文-检查报告-example.html");
console.log("html asset saved");
await browser.close();
