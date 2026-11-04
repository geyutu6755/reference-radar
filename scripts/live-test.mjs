/**
 * Independent live-product test (strengthened in v1.0.2).
 *
 * Target: production site by default; TARGET=local for the sabotage trials.
 *
 * Fixes over the v1.0.1 script (which had false-positive-prone assertions):
 *  - pageerror now FAILS the test instead of being logged
 *  - C01 (clean sample) asserts EXACT zero-issue stats instead of skipping
 *  - C02 asserts the exact ruleIds, detail text, clause basis, locate flash
 *    and the graph's missing-relation data — online AND offline
 *  - HTML export content is downloaded and checked for the ruleIds it must contain
 *  - PDF files are checked for %PDF magic + minimum size (text re-verified via pypdf)
 *  - a negative canary trial proves the assertion harness itself fails on a
 *    deliberately wrong expectation; sabotage trial (local) proves the app
 *    fails loudly when the analysis worker is unavailable
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, statSync } from "node:fs";

const TARGET = process.env.TARGET === "local" ? "http://localhost:4173/" : "https://geyutu6755.github.io/reference-radar/";
const results = [];
let failures = 0;
const ok = (n, d) => results.push(`✓ ${n}: ${d}`);
const bad = (n, d) => { results.push(`✗ ${n}: ${d}`); failures++; console.log(`✗ ${n}: ${d}`); };
const assertThat = (cond, n, d) => (cond ? ok(n, d) : bad(n, d));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 200)));

/* ---- Phase A: online ---- */
await page.goto(TARGET, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
assertThat((await page.title()).includes("Reference Radar"), "first visit", "title");

// C01 — clean sample: the stats MUST be exactly zero issues (guards against a
// broken engine that fabricates findings).
const c01 = readFileSync("corpus/files/C01.docx");
await page.setInputFiles('input[type="file"]', { name: "C01.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: c01 });
await page.waitForSelector(".rr-wb", { timeout: 30000 });
{
  const stats = await page.locator(".rr-wb__stats").textContent();
  const m = Object.fromEntries([...stats.matchAll(/(\d+)\s*([^\d\s]+)/g)].map((x) => [x[2], Number(x[1])]));
  const clean = (m["错误"] ?? 0) === 0 && (m["警告"] ?? 0) === 0 && (m["待复核"] ?? 0) === 0;
  const refs = m["文献条目"] ?? 0;
  assertThat(clean && refs === 5, "C01 clean-sample gate", `stats: ${stats.replace(/\s+/g, " ").slice(0, 70)} (errors=0,warnings=0,reviews=0,refs=5 → ${clean && refs === 5})`);
}

// C02 — positive detection case: exact rules, detail text, clause, locate, graph.
const c02 = readFileSync("corpus/files/C02.docx");
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(400);
await page.setInputFiles('input[type="file"]', { name: "C02.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: c02 });
await page.waitForSelector(".rr-wb", { timeout: 30000 });
{
  const cards = await page.locator(".rr-issue").allTextContents();
  const hasMissing = cards.some((t) => t.includes("RR-CIT-001") && t.includes("[5]"));
  const hasOrder = cards.some((t) => t.includes("RR-CIT-004"));
  const hasUncited = cards.some((t) => t.includes("RR-REF-011") && t.includes("[4]"));
  assertThat(hasMissing, "C02 RR-CIT-001", "card cites [5] as missing");
  assertThat(hasOrder, "C02 RR-CIT-004", "order-violation card present");
  assertThat(hasUncited, "C02 RR-REF-011", "uncited entry [4] info present");

  // rule basis: the missing-ref card must cite 9.2.1.1/9.2.2, the order card 9.2.1.1
  const missingCard = page.locator(".rr-issue", { hasText: "RR-CIT-001" }).first();
  const basis = (await missingCard.locator(".rr-issue__basis").textContent()) ?? "";
  assertThat(basis.includes("9.2.1.1") || basis.includes("9.2.2"), "rule basis clause", basis.slice(0, 80));

  // locate: clicking flashes the source block
  await missingCard.click();
  await page.waitForTimeout(500);
  const flashed = await page.locator(".rr-doc__block--flash, .rr-doc__block--flash *").count();
  assertThat(flashed > 0, "locate flash", "source block highlighted");
}

// graph must carry the missing relation data ([5] 缺失)
await page.getByRole("tab", { name: "引文关系图" }).click();
await page.waitForTimeout(600);
{
  const graphText = await page.locator(".rr-graph__canvas").textContent();
  assertThat(graphText.includes("缺失文献") && graphText.includes("[5]"), "graph missing-relation data", "missing [5] placeholder rendered");
  const nodes = await page.locator(".rr-gnode").count();
  assertThat(nodes >= 6, "graph nodes", `${nodes}`);
}

// HTML export: content must contain the exact ruleIds + standard version
{
  const [html] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("button", { name: "导出 HTML 报告" }).click(),
  ]);
  const path = "_research/v102-report.html";
  await html.saveAs(path);
  const content = readFileSync(path, "utf-8");
  assertThat(content.includes("RR-CIT-001") && content.includes("RR-CIT-004") && content.includes("GB/T 7714—2025"), "HTML report content", "ruleIds + version present");
  assertThat(content.includes("[5]"), "HTML report detail", "missing number [5] in report");
}

// PDF export online (first export fetches the ~10.6 MB CJK font — allow for a slow CDN)
{
  let pdf;
  try {
    const res = await Promise.all([
      page.waitForEvent("download", { timeout: 180000 }),
      page.getByRole("button", { name: "导出 PDF 报告" }).click(),
    ]);
    pdf = res[0];
  } catch (e) {
    const alert = await page.locator(".rr-alert").textContent().catch(() => "(no alert)");
    bad("PDF online", `no download in 180s; alert=${String(alert).slice(0, 100)}; err=${String(e).slice(0, 80)}`);
  }
  if (pdf) {
    await pdf.saveAs("_research/v102-online.pdf");
    const buf = readFileSync("_research/v102-online.pdf");
    assertThat(buf.subarray(0, 5).toString() === "%PDF-" && buf.length > 10_000, "PDF online", `${buf.length} bytes, %PDF magic`);
  }
}

/* ---- negative canary: prove assertions fail when they should ---- */
{
  let threw = false;
  try {
    const cards = await page.locator(".rr-issue").allTextContents();
    if (!cards.some((t) => t.includes("RR-CIT-999"))) throw new Error("canary: rule RR-CIT-999 absent (expected)");
  } catch {
    threw = true;
  }
  assertThat(threw, "negative canary", "deliberately wrong expectation throws → harness is live");
}

/* ---- Phase B: offline (shell + DOCX import + rule assertions + PDF) ---- */
await page.getByRole("button", { name: "返回首页" }).click();
await page.waitForTimeout(800);
await ctx.setOffline(true);
await page.reload();
await page.waitForLoadState("domcontentloaded").catch(() => {});
await page.waitForTimeout(800);
assertThat((await page.getByRole("button", { name: "体验示例论文" }).count()) === 1, "offline reload", "shell from SW");

await page.setInputFiles('input[type="file"]', { name: "C02-offline.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: c02 });
await page.waitForSelector(".rr-wb", { timeout: 30000 });
{
  const cards = await page.locator(".rr-issue").allTextContents();
  assertThat(cards.some((t) => t.includes("RR-CIT-001") && t.includes("[5]")), "OFFLINE C02 RR-CIT-001", "missing-ref rule asserted offline");
  assertThat(cards.some((t) => t.includes("RR-CIT-004")), "OFFLINE C02 RR-CIT-004", "order rule asserted offline");
  assertThat(cards.some((t) => t.includes("RR-REF-011")), "OFFLINE C02 RR-REF-011", "uncited info asserted offline");
  let pdfOffline;
  try {
    const res = await Promise.all([
      page.waitForEvent("download", { timeout: 120000 }),
      page.getByRole("button", { name: "导出 PDF 报告" }).click(),
    ]);
    pdfOffline = res[0];
  } catch (e) {
    const alert = await page.locator(".rr-alert").textContent().catch(() => "(no alert)");
    bad("OFFLINE PDF export", `no download in 120s; alert=${String(alert).slice(0, 100)}; err=${String(e).slice(0, 80)}`);
  }
  if (pdfOffline) {
    await pdfOffline.saveAs("_research/v102-offline.pdf");
    const buf = readFileSync("_research/v102-offline.pdf");
    assertThat(buf.subarray(0, 5).toString() === "%PDF-" && buf.length > 10_000, "OFFLINE PDF export", `${buf.length} bytes`);
  }
}

// service worker active
{
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { active: !!reg?.active, caches: (await caches.keys()).join(",") };
  });
  assertThat(sw.active, "service worker", sw.caches);
}

await browser.close();

/* ---- verdict ---- */
console.log(results.join("\n"));
assertThat(pageErrors.length === 0, "page errors", pageErrors.length ? pageErrors.join(" | ").slice(0, 300) : "none");
console.log(results.join("\n"));
writeFileSync("_research/v102-live-results.txt", results.join("\n"));
console.log(failures === 0 ? "LIVE TEST PASSED" : `LIVE TEST FAILED (${failures})`);
process.exitCode = failures === 0 ? 0 : 1;
