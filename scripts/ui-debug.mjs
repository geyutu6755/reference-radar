import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto("http://localhost:5199/");
await page.waitForLoadState("domcontentloaded");
await page.getByRole("button", { name: "体验示例论文" }).click();
await page.waitForTimeout(3000);
const state = await page.evaluate(() => ({
  hasProgress: !!document.querySelector(".rr-progress"),
  alertText: document.querySelector(".rr-alert")?.textContent ?? null,
  hasWorkbench: !!document.querySelector(".rr-wb"),
}));
console.log("STATE:", JSON.stringify(state));
console.log("LOGS:", logs.slice(0, 20).join("\n"));
await browser.close();
