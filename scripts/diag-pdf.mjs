import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage({ locale: "zh-CN" });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text().slice(0, 150)}`); });
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 200)}`));
await page.goto("https://geyutu6755.github.io/reference-radar/");
await page.waitForTimeout(1000);
const c01 = readFileSync("corpus/files/C01.docx");
await page.setInputFiles('input[type="file"]', { name: "C01.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: c01 });
await page.waitForSelector(".rr-wb", { timeout: 30000 });
console.log("workbench up; starting PDF export at", new Date().toISOString());
const t0 = Date.now();
try {
  const [pdf] = await Promise.all([
    page.waitForEvent("download", { timeout: 240000 }),
    page.getByRole("button", { name: "导出 PDF 报告" }).click(),
  ]);
  console.log("PDF downloaded in", Date.now() - t0, "ms");
  await pdf.saveAs("_research/diag.pdf");
  const buf = readFileSync("_research/diag.pdf");
  console.log("size:", buf.length, "magic:", buf.subarray(0, 5).toString());
} catch (e) {
  console.log("PDF FAILED after", Date.now() - t0, "ms:", String(e).slice(0, 120));
  const busy = await page.getByRole("button", { name: /生成 PDF/ }).count();
  const alert = await page.locator(".rr-alert").textContent().catch(() => null);
  console.log("button still busy:", busy, "| alert:", alert);
}
console.log("LOGS:", logs.slice(0, 10).join("\n") || "none");
await browser.close();
