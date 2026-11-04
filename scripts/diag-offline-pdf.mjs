import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "zh-CN" });
const page = await ctx.newPage();
const failed = [];
page.on("requestfailed", (r) => failed.push(`FAILED: ${r.url().slice(-70)} → ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) failed.push(`HTTP ${r.status()}: ${r.url().slice(-70)}`); });

await page.goto("http://localhost:4180/reference-radar/");
await page.waitForTimeout(1000);
const c01 = readFileSync("corpus/files/C01.docx");
await page.setInputFiles('input[type="file"]', { name: "C01.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: c01 });
await page.waitForSelector(".rr-wb", { timeout: 30000 });
// warm the runtime cache: online PDF export
const [pdf] = await Promise.all([
  page.waitForEvent("download", { timeout: 180000 }),
  page.getByRole("button", { name: "导出 PDF 报告" }).click(),
]);
await pdf.saveAs("_research/diag-online.pdf");
console.log("online PDF ok");
failed.length = 0;

await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(500);
await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "体验示例论文" }).click();
await page.waitForSelector(".rr-wb", { timeout: 30000 });
failed.length = 0;
await page.getByRole("button", { name: "导出 PDF 报告" }).click();
await page.waitForTimeout(15000);
console.log("FAILED REQUESTS during offline export:");
console.log(failed.slice(0, 10).join("\n") || "(none)");
const alert = await page.locator(".rr-alert").textContent().catch(() => "(no alert)");
console.log("alert:", alert);
await browser.close();
