/**
 * V1.1.2 P0 regressions: unbounded citation ranges and year-range misreads.
 *
 * Before the fix, [1-9999] expanded to 9999 citation numbers (flooding the
 * rule engine, the relation graph and the report) and [2001-2010] /
 * [2019] were misread as citations to nonexistent entries.
 */
import { describe, expect, it } from "vitest";
import { analyzeDocx } from "../pipeline";
import { buildDocx } from "../../testing/docx-builder";
import { MAX_PLAUSIBLE_REF_NUMBER, MAX_RANGE_SPAN, MAX_TOTAL_EXPANSION } from "./citations";

const doc = (body: string) =>
  buildDocx({
    paragraphs: [
      { text: "区间压力论文", heading: 1 },
      { text: body },
      { text: "参考文献", heading: 2 },
      { text: "[1] 张三. 某文[J]. 学报, 2020, 1(2): 1-9." },
      { text: "[2] 李四. 某文[J]. 学报, 2021, 2(3): 10-15." },
    ],
  });

describe("P0: citation ranges are bounded", () => {
  it("[1-9999] is parked in review with zero downstream expansion", () => {
    const r = analyzeDocx(doc("参见[1-9999]。"), "abuse.docx", { version: "2025" });
    const c = r.citations[0]!;
    expect(c.numbers).toEqual([]); // nothing floods the engine
    expect(c.detection.needsReview).toBe(true);
    expect(c.detection.signals.join(" ")).toContain("range-too-long:1-9999");
    expect(r.relations).toHaveLength(0); // graph is clean
    // the review queue states the reason
    expect(r.issues.some((i) => i.ruleId === "RR-SCOPE-013" && i.detail.includes("range-too-long"))).toBe(true);
  });

  it("[2001-2010] year range is not a citation", () => {
    const r = analyzeDocx(doc("该标准于[2001-2010]年间执行。"), "year.docx", { version: "2025" });
    const c = r.citations[0]!;
    expect(c.numbers).toEqual([]);
    expect(c.detection.needsReview).toBe(true);
    expect(c.detection.signals.join(" ")).toContain(`implausible-number>${MAX_PLAUSIBLE_REF_NUMBER}`);
    expect(r.issues.some((i) => i.ruleId === "RR-CIT-001")).toBe(false);
  });

  it("[2019] single year is not a citation", () => {
    const r = analyzeDocx(doc("该平台建于[2019]。"), "single.docx", { version: "2025" });
    expect(r.citations[0]!.numbers).toEqual([]);
    expect(r.citations[0]!.detection.needsReview).toBe(true);
    expect(r.issues.some((i) => i.ruleId === "RR-CIT-001")).toBe(false);
  });

  it("legitimate ranges up to the span cap still expand", () => {
    const r = analyzeDocx(doc("参见[1-50]。"), "ok.docx", { version: "2025" });
    // [1-50]: 50 <= MAX_RANGE_SPAN, all numbers <= 999 → expanded normally.
    // [1] and [2] exist in the list; 3..50 are missing → RR-CIT-001 for 48 numbers.
    expect(r.citations[0]!.numbers.length).toBe(Math.min(50, MAX_RANGE_SPAN));
    expect(r.citations[0]!.detection.needsReview).toBe(false);
    expect(r.relations.length).toBe(50);
  });

  it("mixed marker: the plausible part expands, the implausible part is parked", () => {
    const r = analyzeDocx(doc("参见[1,2,2019]。"), "mix.docx", { version: "2025" });
    const c = r.citations[0]!;
    expect(c.numbers).toEqual([1, 2]);
    expect(c.detection.needsReview).toBe(true);
    expect(c.detection.signals.join(" ")).toContain("implausible-number");
  });

  it("cumulative expansion budget stops a flood of range markers", () => {
    const markers = Array.from({ length: 150 }, () => "[1-50]").join("");
    const t0 = performance.now();
    const r = analyzeDocx(doc(`参见${markers}。`), "flood.docx", { version: "2025" });
    const elapsed = performance.now() - t0;
    const expanded = r.citations.reduce((sum, c) => sum + c.numbers.length, 0);
    expect(expanded).toBeLessThanOrEqual(MAX_TOTAL_EXPANSION);
    expect(elapsed).toBeLessThan(5000); // no freeze
    // markers beyond the budget carry the reason
    expect(r.citations.some((c) => c.detection.signals.join(" ").includes("expansion-budget-exhausted"))).toBe(true);
  });
});
