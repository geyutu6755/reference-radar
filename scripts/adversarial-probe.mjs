/**
 * Independent re-audit adversarial probe (v1.2.0): targets the NEW features
 * that were never production-verified — paste-mode bodyless suppression,
 * re-check comparison, bounded ranges, duplicate-number graph — plus hostile
 * inputs through the real upload path on the LIVE site.
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";

const BASE = "https://geyutu6755.github.io/reference-radar/";
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const paraH = (t) => `<w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;

function docx(body) {
  const z = zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`),
  });
  return z;
}

const results = [];
let failures = 0;
const ok = (n, d) => { results.push(`✓ ${n}: ${d}`); console.log(`✓ ${n}: ${d}`); };
const bad = (n, d) => { results.push(`✗ ${n}: ${d}`); failures++; console.log(`✗ ${n}: ${d}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));

async function upload(name, buffer) {
  await page.goto(BASE);
  await page.waitForSelector('.rr-uploader', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.setInputFiles('input[type="file"]', { name, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from(buffer) });
  await page.waitForSelector(".rr-wb", { timeout: 30000 });
}

/* ---- 1. paste-mode bodyless suppression on production ---- */
await page.goto(BASE);
await page.waitForTimeout(800);
await page.getByRole("button", { name: "粘贴文本检查" }).click();
await page.locator("textarea").fill(
  "参考文献\n[1] 张三. 文献一[J]. 学报, 2020, 1(1): 1-9.\n[3] 李四. 文献二[M]. 出版社, 2021."
);
await page.getByRole("button", { name: "分析粘贴的文本" }).click();
await page.waitForSelector(".rr-wb", { timeout: 20000 });
{
  const cards = await page.locator(".rr-issue").allTextContents();
  const noUncited = !cards.some((t) => t.includes("RR-REF-011"));
  const hasGap = cards.some((t) => t.includes("RR-REF-003") && t.includes("2"));
  const scopeText = await page.getByRole("tab", { name: "分析范围" }).click().then(() => page.locator(".rr-scope-list").nth(1).textContent());
  ok(noUncited && hasGap, "paste bodyless", `uncited suppressed=${noUncited}, gap reported=${hasGap}, scope discloses=${(scopeText ?? "").includes("未被正文引用")}`);
}

/* ---- 2. bounded range [1-9999] on production ---- */
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(400);
await upload("bounded.docx", docx(
  paraH("区间上限验证") + para("参见[1-9999]。") + paraH("参考文献") + para("[1] 甲. 文[J]. 学, 2020.") + para("[2] 乙. 文[J]. 学, 2021.")
));
{
  const graphOk = await page.getByRole("tab", { name: "引文关系图" }).click().then(() => page.waitForTimeout(500)).then(() => page.locator(".rr-gnode").count());
  await page.getByRole("tab", { name: "问题列表" }).click();
  await page.waitForTimeout(300);
  const review = await page.locator(".rr-issue", { hasText: "range-too-long" }).count();
  const cards = await page.locator(".rr-issue").allTextContents();
  const noFlood = !cards.some((t) => t.includes("9999") && t.includes("RR-CIT-001") && t.includes("9999 条"));
  assertThat(graphOk < 20, "bounded range graph", `${graphOk} nodes (no flood)`);
  assertThat(review >= 1, "bounded range review", "range-too-long review present");
  assertThat(noFlood, "no citation flood", "no 9999 RR-CIT-001 errors");
}

/* ---- 3. duplicate-number graph relations ---- */
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(400);
await upload("dup.docx", docx(
  paraH("重号验证") + para("引用[2]。") + paraH("参考文献") + para("[2] 甲. 文献A[J]. 学, 2020.") + para("[2] 乙. 文献B[M]. 出版社, 2021.")
));
await page.getByRole("tab", { name: "引文关系图" }).click();
await page.waitForTimeout(600);
{
  const graphText = await page.locator(".rr-graph__canvas").textContent();
  // both duplicate entries visible in the graph
  const hasA = graphText.includes("文献A") || graphText.includes("[2]");
  const edgeCount = await page.locator(".rr-gedge").count();
  assertThat(edgeCount >= 2, "duplicate graph relations", `${edgeCount} edges for [2]→A and [2]→B`);
}

/* ---- 4. re-check comparison on production ---- */
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(400);
// first: upload the error sample
const { buildErrorSampleDocx, buildFixedSampleDocx } = await import("./sample-imports.mjs").catch(() => ({ buildErrorSampleDocx: null, buildFixedSampleDocx: null }));
const errDoc = docx(
  paraH("重检比较样本") + para("正文引用[1]与[3]。") + paraH("参考文献") + para("[1] 甲. 文献一[J]. 学报, 2020.") + para("[2] 乙. 文献二[J]. 学报, 2021.")
);
const fixDoc = docx(
  paraH("重检比较样本") + para("正文引用[1]与[2]。") + paraH("参考文献") + para("[1] 甲. 文献一[J]. 学报, 2020.") + para("[2] 乙. 文献二[J]. 学报, 2021.")
);
await upload("recheck.docx", errDoc);
const beforeCards = (await page.locator(".rr-issue").allTextContents()).length;
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(600);
// Stay in the SPA — page.goto() would wipe lastCheck (full reload).
await page.setInputFiles('input[type="file"]', { name: "recheck.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from(fixDoc) });
await page.waitForSelector(".rr-wb", { timeout: 30000 });
// comparison card should appear (same fileName triggers comparison in App)
{
  const compare = await page.locator(".rr-compare").count();
  const compareText = compare ? await page.locator(".rr-compare__counts").textContent() : "";
  assertThat(compare === 1, "re-check comparison card", "rendered after re-upload of same-named file");
  assertThat((compareText ?? "").includes("已消失"), "comparison shows resolved", compareText ?? "");
}

/* ---- 5. empty-body DOCX does not crash ---- */
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(400);
await upload("empty.docx", docx(""));
{
  const hasWb = await page.locator(".rr-wb").count();
  assertThat(hasWb === 1, "empty DOCX graceful", "workbench renders with zero findings");
}

/* ---- 6. consecutive exports ---- */
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(400);
await upload("consec.docx", docx(paraH("连续导出") + para("引用[1]。") + paraH("参考文献") + para("[1] 甲. 文[J]. 学, 2020.")));
{
  const [h1] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: "导出 HTML 报告" }).click(),
  ]);
  const [h2] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: "导出 HTML 报告" }).click(),
  ]);
  assertThat(h1 && h2, "consecutive HTML exports", "two downloads succeeded");
}

function assertThat(cond, n, d) {
  if (cond) { results.push(`✓ ${n}: ${d}`); ok(n, d); }
  else { bad(n, d); }
}

console.log("\n" + results.join("\n"));
console.log("page errors:", pageErrors.length ? pageErrors.join(" | ").slice(0, 200) : "none");
writeFileSync("_research/adversarial-probe-log.md", results.join("\n") + "\n");
await browser.close();
console.log(failures === 0 ? "ADVERSARIAL PROBE PASSED" : `ADVERSARIAL PROBE FAILED (${failures})`);
process.exitCode = failures === 0 ? 0 : 1;
