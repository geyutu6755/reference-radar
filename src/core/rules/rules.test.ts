import { describe, expect, it } from "vitest";
import { runRules, allRules, rulesForVersion, ruleFailureWarning } from "./engine";
import { RULES } from "./definitions";
import type { Citation, ReferenceEntry, RuleContext } from "../types";

function ctx(partial: Partial<RuleContext> = {}): RuleContext {
  return {
    version: "2025",
    citations: [],
    references: [],
    relations: [],
    blocks: [],
    notes: [],
    scope: {
      analyzedContainers: ["body"],
      excludedNotes: [],
      referenceSectionDetected: true,
    },
    ...partial,
  };
}

function cit(n: number[], raw?: string, needsReview = false): Citation {
  return {
    id: `c${n.join("_")}`,
    raw: raw ?? `[${n.join(",")}]`,
    numbers: n,
    segments: n.map((x) => ({ kind: "single" as const, start: x, end: x, rawStart: 0, rawEnd: 1 })),
    anchor: {
      containerId: "body",
      containerKind: "body",
      paragraphId: "body:p1",
      blockIndex: 1,
      charStart: 0,
      charEnd: 3,
      text: raw ?? `[${n.join(",")}]`,
    },
    contextBefore: "",
    contextAfter: "",
    order: 0,
    isFirstOccurrenceOf: n,
    detection: { confidence: "high", signals: [], needsReview },
  };
}

function ref(index: number, raw = "甲. 文献[J]. 学报, 2020."): ReferenceEntry {
  return {
    id: `r${index}`,
    index,
    displayNumber: `[${index}]`,
    numberingKind: "manual",
    raw,
    fields: {},
    fieldsConfidence: "high",
    anchor: {
      containerId: "body",
      containerKind: "body",
      paragraphId: "body:p2",
      blockIndex: 2,
      charStart: 0,
      charEnd: raw.length,
      text: raw,
    },
    notes: [],
  };
}

describe("rule registry", () => {
  it("every rule has test cases and a verified source", () => {
    for (const r of RULES) {
      expect(r.ruleId).toMatch(/^RR-/);
      expect(r.testCases.length).toBeGreaterThan(0);
      expect(r.source.summary.length).toBeGreaterThan(5);
      expect(["verified-official", "verified-secondary"]).toContain(r.source.status);
    }
  });

  it("version filtering includes shared rules", () => {
    expect(rulesForVersion("2015").length).toBeGreaterThan(5);
    expect(rulesForVersion("2025").length).toBeGreaterThan(5);
    expect(allRules().length).toBeGreaterThanOrEqual(rulesForVersion("2015").length);
  });
});

describe("structural rules", () => {
  it("RR-CIT-001 flags numbers absent from the list", () => {
    const issues = runRules(ctx({ citations: [cit([1]), cit([4])], references: [ref(1)] }));
    const hits = issues.filter((i) => i.ruleId === "RR-CIT-001");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.severity).toBe("error");
  });

  it("RR-CIT-001 skipped without reference section", () => {
    const issues = runRules(
      ctx({ citations: [cit([9])], references: [], scope: { analyzedContainers: ["body"], excludedNotes: [], referenceSectionDetected: false } })
    );
    expect(issues.filter((i) => i.ruleId === "RR-CIT-001")).toHaveLength(0);
  });

  it("RR-REF-002 flags duplicate numbers", () => {
    const issues = runRules(ctx({ references: [ref(1), ref(1, "乙. 另一文献[J]. 学, 2021.")] }));
    expect(issues.filter((i) => i.ruleId === "RR-REF-002")).toHaveLength(1);
  });

  it("RR-REF-003 flags gaps", () => {
    const issues = runRules(ctx({ references: [ref(1), ref(3)] }));
    const hit = issues.find((i) => i.ruleId === "RR-REF-003")!;
    expect(hit).toBeDefined();
    expect(hit.detail).toContain("2");
  });

  it("RR-CIT-004 flags order violation once", () => {
    const issues = runRules(ctx({ citations: [cit([2]), cit([1]), cit([3])] }));
    expect(issues.filter((i) => i.ruleId === "RR-CIT-004")).toHaveLength(1);
  });

  it("RR-CIT-006 flags inverted and degenerate ranges", () => {
    const inverted = cit([], "[5-2]");
    inverted.segments = [{ kind: "range", start: 5, end: 2, rawStart: 1, rawEnd: 4 }];
    inverted.numbers = [];
    const degenerate = cit([], "[3-3]");
    degenerate.segments = [{ kind: "range", start: 3, end: 3, rawStart: 1, rawEnd: 4 }];
    degenerate.numbers = [3];
    const issues = runRules(ctx({ citations: [inverted, degenerate] }));
    const hits = issues.filter((i) => i.ruleId === "RR-CIT-006");
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.severity).sort()).toEqual(["error", "warning"]);
  });

  it("RR-REF-007 flags identical and near-duplicate entries", () => {
    const issues = runRules(
      ctx({
        references: [
          ref(1, "张三. 同一文献题名[J]. 学报, 2020, 1(2): 11-15."),
          ref(2, "张三. 同一文献题名[J]. 学报, 2020, 1(2): 11-15."),
          ref(3, "张三. 同一文献题名[J]. 学报, 2020, 1(2): 11-16."),
        ],
      })
    );
    const hits = issues.filter((i) => i.ruleId === "RR-REF-007");
    expect(hits.some((h) => h.severity === "error")).toBe(true);
    expect(hits.some((h) => h.severity === "review")).toBe(true);
  });

  it("RR-REF-011 reports uncited entries as info", () => {
    const issues = runRules(
      ctx({
        citations: [cit([1])],
        references: [ref(1), ref(2)],
        relations: [{ citationId: "c1", referenceId: "r1", number: 1, missing: false }],
      })
    );
    const hits = issues.filter((i) => i.ruleId === "RR-REF-011");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.severity).toBe("info");
  });

  it("RR-SCOPE-013 surfaces ambiguous markers", () => {
    const issues = runRules(ctx({ citations: [cit([1], "[1]", true)] }));
    expect(issues.filter((i) => i.ruleId === "RR-SCOPE-013")).toHaveLength(1);
  });

  it("RR-FMT-008 flags version-inappropriate codes", () => {
    const ds = ref(1, "某中心. 数据集[DS/OL]. 平台, 2024.");
    ds.fields = { typeCode: "DS", typeIdentifier: "[DS/OL]", carrierCode: "OL" };
    const issues2015 = runRules(ctx({ version: "2015", references: [ds] }));
    expect(issues2015.filter((i) => i.ruleId === "RR-FMT-008")).toHaveLength(1);
    const issues2025 = runRules(ctx({ version: "2025", references: [ds] }));
    expect(issues2025.filter((i) => i.ruleId === "RR-FMT-008")).toHaveLength(0);
  });

  it("a rule that throws is reported, not silently dropped", () => {
    const target = RULES.find((r) => r.ruleId === "RR-FMT-014")!;
    const original = target.check;
    target.check = () => {
      throw new Error("injected rule failure");
    };
    try {
      const warnings: string[] = [];
      const eb = ref(1, "某作者. 网页[EB/OL]. [2025-01-15].");
      eb.fields = { typeCode: "EB", carrierCode: "OL", citedDateRaw: "2025-01-15", citedDate: "2025-01-15" };
      const issues = runRules(ctx({ references: [eb] }), (ruleId, error) =>
        warnings.push(ruleFailureWarning(ruleId, error))
      );
      // The analysis still completes, but the missing check is disclosed.
      expect(issues.filter((i) => i.ruleId === "RR-FMT-014")).toHaveLength(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("RR-FMT-014");
      expect(warnings[0]).toContain("injected rule failure");
    } finally {
      target.check = original;
    }
  });
});
