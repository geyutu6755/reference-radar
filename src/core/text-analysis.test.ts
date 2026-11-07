/**
 * V1.2 regressions for reference-list-only (paste) mode.
 *
 * Goal: with a pasted reference list and no body text, list-internal checks
 * (gaps, duplicates, list order, format) still run, but body-dependent
 * conclusions (uncited entries, citation order) must be suppressed.
 */
import { describe, expect, it } from "vitest";
import { analyzeText } from "./text-analysis";

const REFS = "参考文献\n[1] 张三. 文献一[J]. 学报, 2020, 1(1): 1-9.\n[3] 李四. 文献二[M]. 出版社, 2021.";

describe("paste mode (reference-list-only)", () => {
  it("does not flag every entry as uncited when no body text exists", () => {
    const r = analyzeText(REFS, "paste.docx", { version: "2025" });
    expect(r.references.length).toBe(2);
    expect(r.scope.bodyless).toBe(true);
    expect(r.issues.filter((i) => i.ruleId === "RR-REF-011")).toEqual([]);
  });

  it("still runs list-internal checks: the gap at [2] is reported", () => {
    const r = analyzeText(REFS, "paste.docx", { version: "2025" });
    expect(r.issues.some((i) => i.ruleId === "RR-REF-003" && i.detail.includes("2"))).toBe(true);
  });

  it("discloses the disabled checks in the scope notes", () => {
    const r = analyzeText(REFS, "paste.docx", { version: "2025" });
    const notes = r.scope.excludedNotes.join(" ");
    expect(notes).toContain("引用顺序");
    expect(notes).toContain("未被正文引用");
  });

  it("keeps body-dependent checks when the paste DOES contain citations", () => {
    const withBody = "正文引用[1]与[2]。\n参考文献\n[1] 甲. 文一[J]. 学报, 2020.\n[2] 乙. 文二[J]. 学报, 2021.";
    const r = analyzeText(withBody, "paste2.docx", { version: "2025" });
    expect(r.scope.bodyless).toBe(false);
    expect(r.issues.some((i) => i.ruleId === "RR-REF-011")).toBe(false); // all cited
  });

  it("flags missing numbers and cites correctly when body citations exist", () => {
    const withBody = "正文引用[1]与[3]。\n参考文献\n[1] 甲. 文一[J]. 学报, 2020.";
    const r = analyzeText(withBody, "paste3.docx", { version: "2025" });
    expect(r.issues.some((i) => i.ruleId === "RR-CIT-001")).toBe(true);
  });
});
