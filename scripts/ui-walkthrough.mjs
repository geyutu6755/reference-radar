import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "_research/screenshots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 850 } });
const logs = [];
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

// 1. home
await page.goto("http://localhost:5199/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });

// 2. sample → workbench
await page.getByRole("button", { name: "体验示例论文" }).click();
await page.waitForSelector(".rr-wb", { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/02-workbench.png`, fullPage: false });

// 3. click first issue → basis + locate
const firstIssue = page.locator(".rr-issue").first();
if (await firstIssue.count()) {
  await firstIssue.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/03-issue-detail.png` });
}

// 4. graph tab
await page.getByRole("tab", { name: "引文关系图" }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/04-graph.png` });

// 5. scope tab
await page.getByRole("tab", { name: "分析范围" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/05-scope.png` });

// 6. dark theme + English
await page.getByRole("button", { name: "theme" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/06-dark.png` });
await page.getByRole("button", { name: "language" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/07-en-dark.png` });

// 7. export HTML report
await page.getByRole("button", { name: "theme" }).click();
await page.getByRole("button", { name: "language" }).click();
await page.waitForTimeout(300);
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 8000 }),
  page.getByRole("button", { name: "导出 HTML 报告" }).click(),
]);
const reportPath = `${OUT}/downloaded-report.html`;
await download.saveAs(reportPath);

// 8. home → paste flow
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "粘贴文本检查" }).click();
await page.getByRole("textbox").fill(
  "引言部分引用了文献[1]。并引用缺失编号[9]。\n参考文献\n[1] 张三. 某研究[J]. 学报, 2020."
);
await page.getByRole("button", { name: "分析粘贴的文本" }).click();
await page.waitForSelector(".rr-wb", { timeout: 10000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/08-paste-result.png` });

// 9. error handling: invalid file
await page.getByRole("button", { name: "返回首页" }).click();
await page.setInputFiles('input[type="file"]', {
  name: "fake.docx",
  mimeType: "application/octet-stream",
  buffer: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
});
await page.waitForSelector(".rr-alert--error", { timeout: 8000 });
const alertText = await page.locator(".rr-alert--error").textContent();
await page.screenshot({ path: `${OUT}/09-error-state.png` });

console.log("ALERT:", alertText);
console.log("PAGEERRORS:", logs.length ? logs.join("\n") : "none");
console.log("OK: walkthrough complete, report:", reportPath);
await browser.close();
