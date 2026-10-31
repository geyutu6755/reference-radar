import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => console.log("[console]", m.text().slice(0, 150)));
await page.goto("http://localhost:5200/");
await page.waitForLoadState("load");
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1500);
  const st = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? { installing: !!reg.installing, waiting: !!reg.waiting, active: !!reg.active } : null;
  });
  console.log(i, JSON.stringify(st));
  if (st && st.active) break;
}
await browser.close();
