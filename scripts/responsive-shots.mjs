import { chromium } from "@playwright/test";
const BASE = "http://localhost:4173/";
const browser = await chromium.launch();
for (const [name, w, h] of [["tablet", 768, 1024], ["mobile", 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: "zh-CN" });
  const page = await ctx.newPage();
  // home
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `docs/screenshots/responsive-${name}-home.png`, fullPage: true });
  // workbench via sample
  await page.getByRole("button", { name: "体验示例论文" }).click();
  await page.waitForSelector(".rr-wb", { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/screenshots/responsive-${name}-workbench.png`, fullPage: true });
  // graph tab on mobile too
  await page.getByRole("tab", { name: "引文关系图" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/screenshots/responsive-${name}-graph.png`, fullPage: true });
  await ctx.close();
  console.log(`${name} shots done`);
}
await browser.close();
