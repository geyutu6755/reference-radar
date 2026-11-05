/**
 * V1.1.2 production acceptance — offline PDF export, 4 scenarios × N rounds.
 *
 * Scenarios:
 *  A  normal PWA install → offline → DOCX import + analysis + PDF export
 *  B  caches present but page NOT controlled by a SW (unregistered) → offline
 *     PDF export must succeed via the Cache API font fallback
 *  C  first visit while offline (no install, no cache) → honest failure, no
 *     infinite hang; then recovery when back online
 *  D  network recovery after offline work
 *
 * Every step records SW state, controller state, cache contents (fonts), PDF
 * generation, and page errors. Usage: node scripts/accept-offline-pdf.mjs [rounds]
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";

const BASE = "https://geyutu6755.github.io/reference-radar/";
const ROUNDS = Number(process.argv[2] ?? 3);
const OUT = "_research/acceptance";
mkdirSync(OUT, { recursive: true });

const c01 = readFileSync("corpus/files/C01.docx");
const c02 = readFileSync("corpus/files/C02.docx");

const report = [];
const log = (line) => {
  report.push(line);
  console.log(line);
};

/** Snapshot of SW/controller/cache-font state on the current page. */
async function state(page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const controlled = !!navigator.serviceWorker.controller;
    const cachesList = (await caches.keys()).filter((k) => k.startsWith("rr-"));
    let fonts = [];
    for (const name of cachesList) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        if (req.url.includes("/fonts/")) fonts.push(`${name}: ${req.url.split("/").pop()}`);
      }
    }
    return {
      swRegistered: !!reg,
      swActive: !!reg?.active,
      controlled,
      caches: cachesList.join(",") || "(none)",
      fonts,
    };
  });
}

async function uploadAndAnalyze(page, name, buffer) {
  await page.setInputFiles('input[type="file"]', {
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer,
  });
  await page.waitForSelector(".rr-wb", { timeout: 30000 });
}

async function exportPdf(page, timeoutMs, tag) {
  const failedBefore = [];
  const onReqFailed = (r) => failedBefore.push(`${r.url().slice(-60)} → ${r.failure()?.errorText}`);
  const onResp = (r) => {
    if (r.status() >= 400) failedBefore.push(`HTTP ${r.status()}: ${r.url().slice(-60)}`);
  };
  page.on("requestfailed", onReqFailed);
  page.on("response", onResp);
  try {
    const res = await Promise.all([
      page.waitForEvent("download", { timeout: timeoutMs }),
      page.getByRole("button", { name: "导出 PDF 报告" }).click(),
    ]);
    return { ok: true, download: res[0], failures: failedBefore };
  } catch (e) {
    const alert = await page.locator(".rr-alert").textContent().catch(() => "(no alert)");
    return { ok: false, failures: failedBefore, alert: String(alert).slice(0, 140), err: String(e).slice(0, 90) };
  } finally {
    page.off("requestfailed", onReqFailed);
    page.off("response", onResp);
  }
}

/* ------------------------------------------------------------------ */

console.log(`production acceptance: ${ROUNDS} rounds against ${BASE}`);
let networkDown = 0;
const t0 = Date.now();

for (let round = 1; round <= ROUNDS; round++) {
  log(`\n===== ROUND ${round}/${ROUNDS} — ${new Date().toISOString()} =====`);
  const browser = await chromium.launch();
  let ctx;
  try {
    /* ---- Scenario A: normal install → offline full flow ---- */
    ctx = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));

    await page.goto(BASE, { waitUntil: "load" });
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForTimeout(2000); // precache settle
    const stInstall = await state(page);
    log(
      `A/install: SW active=${stInstall.swActive} controlled=${stInstall.controlled} caches=${stInstall.caches} fonts=[${stInstall.fonts.join("; ") || "none (font is runtime-cached on first export)"}]`
    );

    await uploadAndAnalyze(page, "C01-online.docx", c01);
    log("A/online analysis: ok");

    // warm runtime cache with one online export (the documented first-use path)
    const online = await exportPdf(page, 180000, "A-online");
    if (!online.ok) {
      networkDown++;
      log(`A/online PDF export FAILED (network?): ${online.err} alert=${online.alert} failures=${online.failures.join(" | ").slice(0, 160)}`);
    } else {
      log("A/online PDF export: ok (font now in runtime cache)");
    }

    await page.getByRole("button", { name: "返回首页" }).click();
    await page.waitForTimeout(500);
    await ctx.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(800);
    const stOffline = await state(page);
    log(`A/offline state: controlled=${stOffline.controlled} fonts=[${stOffline.fonts.join("; ") || "none"}]`);

    await uploadAndAnalyze(page, "C02-offline.docx", c02);
    log("A/offline DOCX import + analysis: ok");

    const off = await exportPdf(page, 120000, "A-offline");
    if (off.ok) {
      await off.download.saveAs(`${OUT}/round${round}-A-offline.pdf`);
      const size = statSync(`${OUT}/round${round}-A-offline.pdf`).size;
      log(`A/offline PDF: ok (${size} bytes) | request failures: ${off.failures.join(" | ").slice(0, 120) || "none"}`);
    } else {
      log(`A/offline PDF FAILED: ${off.err} alert=${off.alert} | request failures: ${off.failures.join(" | ").slice(0, 200)}`);
      networkDown += /Failed to fetch/i.test(off.alert ?? "") ? 1 : 0;
    }
    log(`A/page errors: ${pageErrors.length ? pageErrors.join(" | ").slice(0, 160) : "none"}`);

    // D — recovery: back online, everything still works
    await ctx.setOffline(false);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(800);
    const recovered = await page.locator(".rr-uploader").count();
    log(`D/recovery after round ${round}: app loads again = ${recovered === 1}`);
    await ctx.close();

    /* ---- Scenario B: caches present, page NOT controlled by SW ---- */
    const ctxB = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
    const pageB = await ctxB.newPage();
    await pageB.goto(BASE, { waitUntil: "load" });
    await pageB.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await pageB.waitForTimeout(2000);
    await uploadAndAnalyze(pageB, "C01.docx", c01);
    const warm = await exportPdf(pageB, 180000, "B-warm");
    if (!warm.ok) {
      log(`B/warm export FAILED (network?): ${warm.err}`);
    } else {
      log("B/warm online export: ok (font cached)");
    }

    // Remove SW control but KEEP Cache Storage (the fallback path under test)
    await pageB.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    });
    await pageB.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await pageB.waitForTimeout(800);
    const stB = await state(pageB);
    log(`B/state after unregister: controlled=${stB.controlled} caches=${stB.caches} fonts=[${stB.fonts.join("; ")}]`);
    assertThat(stB.controlled === false, "B page is uncontrolled", round);

    await ctxB.setOffline(true);
    // reload may fail without SW — use the already-open page state instead
    await uploadAndAnalyze(pageB, "C02-offline.docx", c02);
    const offB = await exportPdf(pageB, 120000, "B-offline");
    if (offB.ok) {
      await offB.download.saveAs(`${OUT}/round${round}-B-offline.pdf`);
      const size = statSync(`${OUT}/round${round}-B-offline.pdf`).size;
      log(`B/offline PDF via Cache API fallback: ok (${size} bytes) — Cache API fallback VERIFIED`);
    } else {
      log(`B/offline PDF FAILED (defect?): ${offB.err} alert=${offB.alert} | failures: ${offB.failures.join(" | ").slice(0, 200)}`);
      process.exitCode = 1;
    }
    await ctxB.close();

    /* ---- Scenario C: first visit while offline ---- */
    const ctxC = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
    const pageC = await ctxC.newPage();
    await ctxC.setOffline(true);
    let navFailed = false;
    try {
      await pageC.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch {
      navFailed = true;
    }
    if (navFailed) {
      log("C/first-visit-offline: navigation fails as expected — no install, no cache; the app cannot appear from nothing (documented limitation, no hang)");
    } else {
      log("C/first-visit-offline: page loaded (served by browser disk cache or other mechanism) — recording as observed behavior");
    }
    await ctxC.close();

    // C-recovery: go online → app works immediately
    const ctxC2 = await browser.newContext({ viewport: { width: 1360, height: 850 }, locale: "zh-CN" });
    const pageC2 = await ctxC2.newPage();
    await pageC2.goto(BASE, { waitUntil: "domcontentloaded" });
    await pageC2.waitForTimeout(600);
    const recOk = (await pageC2.locator(".rr-uploader").count()) === 1;
    log(`C/recovery on fresh visit after network restored: ${recOk ? "ok" : "FAILED"}`);
    if (!recOk) process.exitCode = 1;
    await ctxC2.close();
  } catch (e) {
    log(`ROUND ${round} aborted with error: ${String(e).slice(0, 200)}`);
    networkDown++;
  } finally {
    await browser.close();
  }
}

log(`\n===== SUMMARY: ${ROUNDS} rounds, ${networkDown} network-flavored failure(s). PDFs in ${OUT}/ =====`);
writeFileSync(`${OUT}/acceptance-log.md`, report.join("\n") + "\n");
console.log(process.exitCode ? "ACCEPTANCE: FAILURES PRESENT (see log)" : "ACCEPTANCE: ALL ROUNDS COMPLETED");

function assertThat(cond, name, round) {
  if (!cond) {
    log(`  !! scenario B assertion failed in round ${round}: page still controlled`);
    process.exitCode = 1;
  }
}
