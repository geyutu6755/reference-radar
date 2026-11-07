import { describe, expect, it } from "vitest";
import { compareRuns, comparisonSummary } from "./compare";
import type { AnalysisResult, Issue } from "./types";

function issue(ruleId: string, detail: string, severity: Issue["severity"] = "error"): Issue {
  return {
    id: `iss-${ruleId}-${detail}`,
    ruleId,
    standardVersion: "2025",
    category: "citation-reference-consistency",
    severity: severity as Issue["severity"],
    messageKey: "issue.test",
    detail,
    anchors: [],
    source: { clause: "9.2.1.1", summary: "test", status: "verified-official" },
    confidence: "high",
    requiresManualCheck: false,
    relatedIds: [],
  };
}

function result(issues: Issue[], version: "2015" | "2025" = "2025"): AnalysisResult {
  return {
    fileName: "t.docx",
    analyzedAt: new Date().toISOString(),
    version,
    blocks: [],
    citations: [],
    references: [],
    relations: [],
    issues,
    stats: {
      blockCount: 0,
      citationCount: 0,
      citationMarkerCount: 0,
      distinctCitedNumbers: 0,
      referenceCount: 0,
      rulesRun: [],
      errorCount: issues.filter((i) => i.severity === "error").length,
      warningCount: 0,
      reviewCount: 0,
      infoCount: 0,
    },
    scope: { analyzedContainers: [], excludedNotes: [], referenceSectionDetected: false },
    parseWarnings: [],
  };
}

describe("run comparison", () => {
  it("classifies resolved / introduced / persistent findings", () => {
    const prev = result([issue("RR-CIT-001", "missing [5]"), issue("RR-REF-002", "dup [2]"), issue("RR-REF-011", "uncited [3]", "info")]);
    const curr = result([issue("RR-REF-002", "dup [2]"), issue("RR-CIT-004", "order violation")]);
    const c = compareRuns(prev, curr);
    expect(c.resolved.map((i) => i.detail)).toEqual(["missing [5]", "uncited [3]"]);
    expect(c.introduced.map((i) => i.detail)).toEqual(["order violation"]);
    expect(c.persistent.map((i) => i.detail)).toEqual(["dup [2]"]);
  });

  it("flags a version mismatch between runs", () => {
    const c = compareRuns(result([]), result([], "2015" as const));
    expect(c.versionMismatch).toBe(true);
    expect(comparisonSummary(c)).toContain("不同标准版本");
  });

  it("summary text counts", () => {
    const c = compareRuns(
      result([issue("RR-CIT-001", "missing [5]")]),
      result([])
    );
    expect(comparisonSummary(c)).toBe("已消失 1 · 新出现 0 · 仍然存在 0");
  });

  it("empty runs compare cleanly", () => {
    const c = compareRuns(result([]), result([]));
    expect(c.persistent).toHaveLength(0);
    expect(comparisonSummary(c)).toBe("已消失 0 · 新出现 0 · 仍然存在 0");
  });

  it("same issue in both runs matches despite shifting anchor text (id excluded)", () => {
    // anchor shift changes nothing: ids are regenerated per run but excluded
    const prev = result([issue("RR-CIT-001", "missing [5]")]);
    prev.issues[0]!.anchors = [{ containerId: "old", containerKind: "body", paragraphId: "old-p", blockIndex: 3, charStart: 0, charEnd: 3, text: "[5]" }];
    const curr = result([issue("RR-CIT-001", "missing [5]")]);
    curr.issues[0]!.anchors = [{ containerId: "new", containerKind: "body", paragraphId: "new-p", blockIndex: 7, charStart: 2, charEnd: 5, text: "[5]" }];
    const c = compareRuns(prev, curr);
    expect(c.persistent).toHaveLength(1);
    expect(c.resolved).toHaveLength(0);
  });
});
