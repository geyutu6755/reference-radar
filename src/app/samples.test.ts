/** The three home-page samples must run through the REAL engine and produce
 *  distinctly different, hand-predictable result profiles. */
import { describe, expect, it } from "vitest";
import { analyzeDocx } from "../core/pipeline";
import { buildSampleDocx, buildErrorSampleDocx, buildFormatSampleDocx } from "./sample-doc";

describe("home-page samples (real engine)", () => {
  it("sample A (correct paper) has zero deterministic errors", () => {
    const r = analyzeDocx(buildSampleDocx(), "sA.docx", { version: "2025" });
    expect(r.stats.errorCount).toBe(0);
    expect(r.stats.warningCount).toBe(0);
  });

  it("sample B (citation errors) reports missing ref + duplicate + order", () => {
    const r = analyzeDocx(buildErrorSampleDocx(), "sB.docx", { version: "2025" });
    expect(r.stats.errorCount).toBeGreaterThanOrEqual(3);
    expect(r.issues.some((i) => i.ruleId === "RR-CIT-001")).toBe(true);
    expect(r.issues.some((i) => i.ruleId === "RR-REF-002")).toBe(true);
    expect(r.issues.some((i) => i.ruleId === "RR-CIT-004")).toBe(true);
  });

  it("sample C (format issues) offers mechanical fix previews", () => {
    const r = analyzeDocx(buildFormatSampleDocx(), "sC.docx", { version: "2025" });
    expect(r.issues.some((i) => i.ruleId === "RR-FMT-011" && i.fixPreview)).toBe(true);
    expect(r.issues.some((i) => i.ruleId === "RR-FMT-017" && i.fixPreview)).toBe(true);
  });
});
