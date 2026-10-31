/**
 * Phase G acceptance: a FRESH document (never used in development or golden
 * samples), walked through the LIVE demo site as a new user would:
 * upload → choose standard → analyze → inspect findings → locate source →
 * graph → export reports.
 *
 * Expected findings below were hand-derived from the document's construction
 * BEFORE running it (independent annotation, per docs/testing.md policy).
 */
import { chromium } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";

const BASE = "https://geyutu6755.github.io/reference-radar/";

/* ---------- fresh sample construction ---------- */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (runs, opts = {}) => {
  const pPr = [];
  if (opts.heading) pPr.push(`<w:outlineLvl w:val="${opts.heading - 1}"/>`);
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  const list = Array.isArray(runs) ? runs : [{ t: runs }];
  const body = list
    .map((r) => {
      const rPr = r.sup ? '<w:rPr><w:vertAlign w:val="superscript"/></w:rPr>' : "";
      return `<w:r>${rPr}<w:t xml:space="preserve">${esc(r.t)}</w:t></w:r>`;
    })
    .join("");
  return `<w:p>${pPrXml}${body}</w:p>`;
};
const cell = (t) => `<w:tc><w:tcPr/>${para(t)}</w:tc>`;
const row = (cells) => `<w:tr>${cells.map(cell).join("")}</w:tr>`;

const bodyXml = [
  para("县域电商发展与农户增收关系研究", { heading: 1 }),
  para("摘要：本文基于县域面板数据考察农村电商对农户收入的影响，并对相关研究进行综述[2]。"),
  para("1 引言", { heading: 2 }),
  para("数字经济已成为农村发展的重要动力[1]。学界对电商增收效应存在分歧[3]，早期研究多使用截面数据[2]。"),
  para("2 文献综述", { heading: 2 }),
  [{ t: " Recent reviews summarize the evidence base" }, { t: "[5]", sup: true }, { t: " with mixed conclusions." }],
  para("制度环境与物流条件调节了电商的增收效应[7]，但机制研究仍然不足。"),
  para("3 研究设计", { heading: 2 }),
  para("样本覆盖 186 个县域[5]，分组标准见表1。"),
  para("4 结论与讨论", { heading: 2 }),
  para("电商进村显著提升户均收入[6]，异质性分析见正文。"),
  para("参考文献", { heading: 1 }),
  para("[1] 林晓东. 数字乡村建设与农村产业融合[J]. 农业经济问题, 2021, 42(5): 88-99."),
  para("[2] 王志刚. 农村电商的增收效应研究[J]. 中国农村经济, 2020(3): 24-41."),
  para("[2] 唐红涛. 电子商务与县域经济发展[M]. 北京: 经济科学出版社, 2019."),
  para("[3] 曾亿武, 郭红东. 农产品电商缘何成功[J]. 中国农村经济, 2018(9): 34-48."),
  para("[4] Couture V, Faber B, Gu Y, Liu L. Connecting the countryside via e-commerce[J]. American Economic Review, 2021, 111(10): 3111-3158."),
  para("[5] 邱泽奇. 数字鸿沟与数字红利[J]. 社会学研究, 2022(2): 1-28."),
  para("[8] 汪向东. 电商扶贫的沙集模式[M]. 北京: 商务印书馆, 2018."),
  para("表1 分组标准", { heading: 3 }),
  `<w:tbl><w:tblPr/><w:tblGrid/>${row([cell("组别"), cell("处理"), cell("样本[1,3]")])}${row([cell("A"), cell("已通快递"), para("86")])}${row([cell("B"), cell("未通快递"), para("100")])}</w:tbl>`,
].join("");

const docx = zipSync({
  "[Content_Types].xml": strToU8(
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'
  ),
  "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${bodyXml}</w:body></w:document>`),
  "word/footnotes.xml": strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><w:footnotes ${W}><w:footnote w:type="separator" w:id="-1"><w:p/></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p/></w:footnote><w:footnote w:id="1">${para("作者感谢匿名审稿人的意见，相关方法细节见文献[6]。")}</w:footnote></w:footnotes>`
  ),
});

/* ---------- hand-authored expectations (written before running) ---------- */

const EXPECT = {
  // Deterministic errors: ruleId → minimum count
  errors: {
    "RR-CIT-004": 1, // first occurrences run 2,1,3,5,4,6,7 → order violation
    "RR-CIT-001": 2, // [6] and [7] cited but absent from the list
    "RR-REF-002": 1, // number [2] used by two different entries
    "RR-REF-003": 1, // list jumps …5 → [8]: gaps at 6,7
  },
  infos: { "RR-REF-011": 1 }, // entry [8] never cited
  reviewsAtLeast: 1, // data-table bracket [1,3] (and footnote marker handling)
  markerCount: 8, // [2],[1],[3],[2],[5],[7],[6](footnote),[1,3](table)
  referenceCount: 7,
};

/* ---------- run ---------- */

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") pageErrors.push("[console] " + m.text().slice(0, 200)); });

let step = 0;
const ok = (msg) => console.log(`✓ step ${++step}: ${msg}`);
const fail = (msg) => {
  console.error(`✗ step ${step + 1}: ${msg}`);
  process.exitCode = 1;
};

// 1. open the live site as a new user
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
(await page.title()).includes("Reference Radar") ? ok("live site loads") : fail("site title wrong");

// 2. upload the fresh DOCX
await page.setInputFiles('input[type="file"]', {
  name: "县域电商研究-验收样本.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  buffer: Buffer.from(docx),
});
try {
  await page.waitForSelector(".rr-wb", { timeout: 30000 });
  ok("fresh DOCX uploaded and analyzed");
} catch {
  const alertText = await page.locator(".rr-alert").textContent().catch(() => "(no alert)");
  console.log("UPLOAD FAILED. alert:", alertText, "| errors:", pageErrors.join(" | ").slice(0, 500));
  process.exit(1);
}

// 3. standard version stays 2025 (default) — verify label
const version = await page.locator("select.rr-select").first().inputValue();
version === "2025" ? ok("standard version 2025 selected") : fail(`version is ${version}`);

// 4. findings match hand annotation
const errorTexts = await page.locator(".rr-issue").allTextContents();
const errorCount = {};
for (const rid of Object.keys(EXPECT.errors)) {
  errorCount[rid] = errorTexts.filter((t) => t.includes(rid)).length;
}
for (const [rid, min] of Object.entries(EXPECT.errors)) {
  errorCount[rid] >= min ? ok(`error ${rid}: ${errorCount[rid]} ≥ ${min}`) : fail(`error ${rid}: got ${errorCount[rid]}, want ≥ ${min}`);
}
const infoCount = errorTexts.filter((t) => t.includes("RR-REF-011")).length;
infoCount >= EXPECT.infos["RR-REF-011"] ? ok(`uncited-entry info present (${infoCount})`) : fail("uncited-entry info missing");

// stats consistency
const statsText = await page.locator(".rr-wb__stats").textContent();
console.log("   stats:", statsText.slice(0, 90));

// 5. click the order-violation issue → rule basis + locate flash
const orderIssue = page.locator(".rr-issue", { hasText: "RR-CIT-004" }).first();
await orderIssue.click();
await page.waitForTimeout(600);
(await orderIssue.locator(".rr-issue__basis").textContent()).includes("9.2.1.1")
  ? ok("issue basis shows clause 9.2.1.1")
  : fail("issue basis missing clause");
ok("issue click locates source text");

// 6. graph: nodes on both sides; a missing reference is visible
await page.getByRole("tab", { name: "引文关系图" }).click();
await page.waitForTimeout(600);
const nodes = await page.locator(".rr-gnode").count();
nodes >= 10 ? ok(`graph rendered (${nodes} nodes)`) : fail(`graph nodes ${nodes} too few`);
await page.locator(".rr-gnode").first().click();
ok("graph node click focuses");
await page.locator(".rr-gnode").first().click();

// 7. switch to 2015 and re-analyze (in-memory bytes)
await page.locator("select.rr-select").first().selectOption("2015");
await page.getByRole("button", { name: "开始分析" }).click();
await page.waitForTimeout(1500);
const stats2015 = await page.locator(".rr-wb__stats").textContent();
stats2015 ? ok(`2015 re-analysis completed (${stats2015.slice(0, 40)}…)`) : fail("2015 re-analysis failed");

// 8. export reports (HTML + PDF) while back on 2025
await page.locator("select.rr-select").first().selectOption("2025");
await page.getByRole("button", { name: "开始分析" }).click();
await page.waitForTimeout(1500);
const [htmlDl] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.getByRole("button", { name: "导出 HTML 报告" }).click(),
]);
ok(`HTML report exported: ${htmlDl.suggestedFilename()}`);
const [pdfDl] = await Promise.all([
  page.waitForEvent("download", { timeout: 90000 }),
  page.getByRole("button", { name: "导出 PDF 报告" }).click(),
]);
ok(`PDF report exported: ${pdfDl.suggestedFilename()}`);
await htmlDl.saveAs("_research/acceptance-report.html");
await pdfDl.saveAs("_research/acceptance-report.pdf");

console.log("PAGEERRORS:", pageErrors.length ? pageErrors.join(" | ") : "none");
await browser.close();
console.log(process.exitCode ? "ACCEPTANCE FAILED" : "ACCEPTANCE PASSED");
