import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 850 } });
await page.goto("http://localhost:4173/");
await page.waitForTimeout(600);
await page.screenshot({ path: "docs/screenshots/home.png" });
await page.getByRole("button", { name: "体验示例论文" }).click();
await page.waitForSelector(".rr-wb", { timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: "docs/screenshots/workbench.png" });
// issue detail
const issue = page.locator(".rr-issue").first();
if (await issue.count()) { await issue.click(); await page.waitForTimeout(600); }
await page.screenshot({ path: "docs/screenshots/issue-basis.png" });
// graph
await page.getByRole("tab", { name: "引文关系图" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "docs/screenshots/graph.png" });
// dark
await page.getByRole("button", { name: "theme" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "docs/screenshots/graph-dark.png" });
await page.getByRole("button", { name: "theme" }).click();
console.log("done");
await browser.close();
