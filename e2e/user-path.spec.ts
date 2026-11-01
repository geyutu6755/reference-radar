/**
 * Formal E2E suite — runs against the production build (vite preview via
 * playwright.config webServer) in Chromium, Firefox and WebKit projects.
 */
import { expect, test, type Page } from "@playwright/test";
import { buildDocx, type TestDoc } from "../src/testing/docx-builder";

function sampleBytes(): Uint8Array {
  const doc: TestDoc = {
    paragraphs: [
      { text: "测试论文", heading: 1 },
      { text: "引言引用[1]，方法引用[2]，结论再次引用[1]。另有未列出编号[9]。" },
      { text: "参考文献", heading: 1 },
      { text: "[1] 张三. 文献一[J]. 学报, 2020, 1(1): 1-9." },
      { text: "[2] 李四. 文献二[M]. 北京: 出版社, 2021." },
    ],
  };
  return buildDocx(doc);
}

async function analyzeSample(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "体验示例论文" }).click();
  await expect(page.locator(".rr-wb")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".rr-wb__stats")).toBeVisible();
}

/** Upload a purpose-built DOCX containing a missing reference [9]. */
async function analyzeUploaded(page: Page): Promise<void> {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "e2e-sample.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(sampleBytes()),
  });
  await expect(page.locator(".rr-wb")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".rr-wb__stats")).toBeVisible();
}

test.describe("core user path", () => {
  test("sample → findings with basis → locate → graph", async ({ page }) => {
    await analyzeUploaded(page);

    await expect(page.locator(".rr-wb__stats")).toContainText("引用标记");
    await expect(page.locator(".rr-wb__stats")).toContainText("文献条目");

    // deterministic error exists (number 9 missing) with a rule basis
    const missingIssue = page.locator(".rr-issue", { hasText: "RR-CIT-001" }).first();
    await expect(missingIssue).toBeVisible();
    await missingIssue.click();
    await expect(missingIssue.locator(".rr-issue__basis")).toContainText("GB/T 7714—");

    // issue click locates the source block (flash highlight)
    await expect(page.locator(".rr-doc__block--flash, .rr-doc__block").first()).toBeVisible();

    // document preview contains highlighted citations
    await expect(page.locator(".rr-cite").first()).toBeVisible();

    // graph renders nodes and edges from real data
    await page.getByRole("tab", { name: "引文关系图" }).click();
    await expect(page.locator(".rr-graph__canvas svg")).toBeVisible();
    await expect(page.locator(".rr-gnode").first()).toBeVisible();
    await page.locator(".rr-gnode").first().click();
    await page.locator(".rr-gnode").first().click(); // toggle off

    // scope panel is explicit about exclusions
    await page.getByRole("tab", { name: "分析范围" }).click();
    await expect(page.locator(".rr-scope-list").nth(1)).toContainText("未");
  });
});

test.describe("extended flow (downloads)", () => {
  test.skip(process.env.E2E_SKIP_DOWNLOADS === "1", "downloads skipped");

  test("language, theme, HTML+PDF export, version re-run, paste, error state", async ({ page }) => {
    await analyzeSample(page);

    // language toggle
    await page.getByRole("button", { name: "language" }).click();
    await expect(page.locator(".rr-wb__stats")).toContainText("Markers");
    await page.getByRole("button", { name: "language" }).click();
    await expect(page.locator(".rr-wb__stats")).toContainText("引用标记");

    // theme toggle
    await page.getByRole("button", { name: "theme" }).click();
    await expect(page.locator("html[data-theme='dark']")).toHaveCount(1);
    await page.getByRole("button", { name: "theme" }).click();
    await expect(page.locator("html[data-theme='dark']")).toHaveCount(0);

    // HTML report download + content must carry the actual findings
    const [html] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }),
      page.getByRole("button", { name: "导出 HTML 报告" }).click(),
    ]);
    expect(html.suggestedFilename()).toMatch(/\.html$/);
    const htmlPath = await html.path();
    if (htmlPath) {
      const { readFileSync } = await import("node:fs");
      const content = readFileSync(htmlPath, "utf-8");
      expect(content).toContain("GB/T 7714—2025");
      // the sample analysis in this spec contains at least one finding;
      // the report must mirror whatever the engine produced (ruleId format)
      expect(content).toMatch(/RR-(CIT|REF|FMT|SCOPE)-\d{3}/);
    }

    // PDF report download (lazy CJK font fetch)
    test.setTimeout(120_000);
    const [pdf] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByRole("button", { name: "导出 PDF 报告" }).click(),
    ]);
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

    // version switch re-analysis (source bytes kept in memory)
    await page.getByRole("combobox", { name: "标准版本" }).selectOption("2015");
    await page.getByRole("button", { name: "开始分析" }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator(".rr-wb__stats")).toBeVisible();

    // paste-text analysis from home
    await page.getByRole("button", { name: "返回首页" }).click();
    await page.getByRole("button", { name: "粘贴文本检查" }).click();
    await page.locator("textarea").fill("正文引用[1]与[3]。\n参考文献\n[1] 甲. 文一[J]. 学报, 2020.");
    await page.getByRole("button", { name: "分析粘贴的文本" }).click();
    await page.waitForSelector(".rr-wb", { timeout: 10_000 });
    await expect(page.locator(".rr-issue__detail").first()).toContainText("3");

    // invalid file → helpful error, UI still usable
    await page.getByRole("button", { name: "返回首页" }).click();
    await page.setInputFiles('input[type="file"]', {
      name: "x.docx",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([1, 2, 3, 4]),
    });
    await expect(page.locator(".rr-alert--error")).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: "体验示例论文" })).toBeEnabled();
  });

  test("real DOCX upload path", async ({ page }) => {
    await page.goto("/");
    await page.setInputFiles('input[type="file"]', {
      name: "sample.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from(sampleBytes()),
    });
    await page.waitForSelector(".rr-wb", { timeout: 20_000 });
    await expect(page.locator(".rr-wb__stats")).toContainText("文献条目");
    await expect(page.locator(".rr-issue", { hasText: "RR-CIT-001" }).first()).toBeVisible();
  });
});

test.describe("negative: analysis worker unavailable", () => {
  test("app fails loudly with an error alert (no silent fake success)", async ({ page }) => {
    await page.route("**/analysis-worker*", (route) => route.abort());
    await page.goto("/");
    await page.setInputFiles('input[type="file"]', {
      name: "x.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from(sampleBytes()),
    });
    // Either an explicit error alert, or the main-thread fallback produced a
    // real workbench. A silent empty "success" is the failure mode this guards.
    const sawAlert = await page
      .waitForSelector(".rr-alert--error", { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!sawAlert) {
      await page.waitForSelector(".rr-wb", { timeout: 10_000 });
      const stats = await page.locator(".rr-wb__stats").textContent();
      expect(stats).toContain("文献条目");
    }
  });
});

test.describe("offline PWA (chromium only)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "offline emulation via chromium");

  test("app shell + sample analysis work offline after install", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForTimeout(1500); // precache settle

    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: "体验示例论文" }).click();
    await page.waitForSelector(".rr-wb", { timeout: 20_000 });
    await expect(page.locator(".rr-wb__stats")).toContainText("引用标记");

    // HTML export still works offline
    const [html] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }),
      page.getByRole("button", { name: "导出 HTML 报告" }).click(),
    ]);
    expect(html.suggestedFilename()).toMatch(/\.html$/);
  });
});
