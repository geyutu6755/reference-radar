import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto("http://localhost:5200/");
await page.waitForLoadState("load");
await page.waitForTimeout(3000);
const st = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    // try manual registration to see the error
    try {
      const r = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      return { manual: "ok", scope: r.scope };
    } catch (e) {
      return { manual: "fail", error: String(e) };
    }
  }
  return { reg: true, active: !!reg.active };
});
console.log("STATE:", JSON.stringify(st));
console.log("LOGS:", logs.join("\n"));
await browser.close();
