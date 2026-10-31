import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 850 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// 1. online: load + wait for SW ready
await page.goto("http://localhost:5200/");
await page.waitForLoadState("load");
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await page.waitForTimeout(1500); // precache settle
// warm the font runtime cache with one online PDF export? — skip: HTML-only offline proof + shell

// 2. offline
await context.setOffline(true);
await page.reload();
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(600);
console.log("OFFLINE title:", await page.title());

// 3. offline sample analysis (full engine, from precached app)
await page.getByRole("button", { name: "体验示例论文" }).click();
await page.waitForSelector(".rr-wb", { timeout: 20000 });
console.log("OFFLINE analysis: OK");
await page.screenshot({ path: "_research/screenshots/10-offline-workbench.png" });

// 4. offline HTML export
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 15000 }),
  page.getByRole("button", { name: "导出 HTML 报告" }).click(),
]);
await download.saveAs("_research/screenshots/offline-report.html");
console.log("OFFLINE HTML export: OK");

// 5. offline paste analysis
await page.getByRole("button", { name: "返回首页" }).click();
await page.getByRole("button", { name: "粘贴文本检查" }).click();
await page.getByRole("textbox").fill("测试[1]。\n参考文献\n[1] 甲. 文[J]. 学, 2020.");
await page.getByRole("button", { name: "分析粘贴的文本" }).click();
await page.waitForSelector(".rr-wb", { timeout: 10000 });
console.log("OFFLINE paste analysis: OK");
console.log("PAGEERRORS:", errors.length ? errors.join(" | ") : "none");
await browser.close();
