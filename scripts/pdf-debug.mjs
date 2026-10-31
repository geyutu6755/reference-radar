import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
await page.goto("http://localhost:5200/");
await page.getByRole("button", { name: "体验示例论文" }).click();
await page.waitForSelector(".rr-wb", { timeout: 15000 });
try {
  await Promise.all([
    page.waitForEvent("download", { timeout: 45000 }),
    page.getByRole("button", { name: "导出 PDF 报告" }).click(),
  ]);
  console.log("DOWNLOADED");
} catch {
  console.log("NO DOWNLOAD");
}
console.log(logs.join("\n"));
await browser.close();
