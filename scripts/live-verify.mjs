import { chromium } from "@playwright/test";
const BASE = "https://geyutu6755.github.io/reference-radar/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));

// 1. home loads
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
console.log("1. home title:", await page.title());

// 2. sample analysis
await page.getByRole("button", { name: "体验示例论文" }).click();
await page.waitForSelector(".rr-wb", { timeout: 30000 });
console.log("2. sample analysis: OK — stats:", (await page.locator(".rr-wb__stats").textContent()).slice(0, 80));

// 3. graph
await page.getByRole("tab", { name: "引文关系图" }).click();
await page.waitForTimeout(500);
console.log("3. graph nodes:", await page.locator(".rr-gnode").count());

// 4. HTML export
const [html] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.getByRole("button", { name: "导出 HTML 报告" }).click(),
]);
console.log("4. HTML export:", html.suggestedFilename());

// 5. PDF export
const [pdf] = await Promise.all([
  page.waitForEvent("download", { timeout: 90000 }),
  page.getByRole("button", { name: "导出 PDF 报告" }).click(),
]);
console.log("5. PDF export:", pdf.suggestedFilename());

// 6. real docx upload
await page.getByRole("button", { name: "返回首页" }).click();
const { buildDocx } = await import("./docx-helper.mjs");
await page.setInputFiles('input[type="file"]', {
  name: "live.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  buffer: Buffer.from(buildDocx()),
});
await page.waitForSelector(".rr-wb", { timeout: 30000 });
console.log("6. real docx upload: OK");

// 7. PWA installability signals
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(1500);
const pwa = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const manifestOk = !!document.querySelector('link[rel="manifest"]');
  return { sw: !!reg, manifest: manifestOk, https: location.protocol === "https:" };
});
console.log("7. PWA:", JSON.stringify(pwa));

console.log("PAGEERRORS:", errors.length ? errors.join(" | ") : "none");
await browser.close();
console.log("LIVE VERIFY DONE");
