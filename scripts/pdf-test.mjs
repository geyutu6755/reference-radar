import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 850 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:5200/");
await page.getByRole("button", { name: "体验示例论文" }).click();
await page.waitForSelector(".rr-wb", { timeout: 15000 });
const t0 = Date.now();
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 60000 }),
  page.getByRole("button", { name: "导出 PDF 报告" }).click(),
]);
await download.saveAs("_research/screenshots/downloaded-report.pdf");
console.log("PDF downloaded in", Date.now() - t0, "ms →", download.suggestedFilename());
await browser.close();
