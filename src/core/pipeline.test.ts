import { describe, expect, it } from "vitest";
import { analyzeDocx } from "./pipeline";
import { buildDocx, type TestDoc } from "../testing/docx-builder";

function analyze(doc: TestDoc, version: "2015" | "2025" = "2025") {
  return analyzeDocx(buildDocx(doc), "test.docx", { version });
}

describe("analysis pipeline", () => {
  it("links citations to references end-to-end", () => {
    const r = analyze({
      paragraphs: [
        { text: "引言部分引用了文献[1]和方法[2]。" },
        { text: "参考文献" , heading: 1 },
        { text: "[1] 张三. 文献一[J]. 学报, 2020, 1(1): 1-9." },
        { text: "[2] 李四. 文献二[M]. 北京: 出版社, 2021." },
      ],
    });
    expect(r.citations).toHaveLength(2);
    expect(r.references).toHaveLength(2);
    expect(r.relations).toHaveLength(2);
    expect(r.relations.every((rel) => !rel.missing)).toBe(true);
    expect(r.scope.referenceSectionDetected).toBe(true);
    expect(r.scope.referenceSectionTitle).toBe("参考文献");
  });

  it("reports missing references through rules", () => {
    const r = analyze({
      paragraphs: [
        { text: "正文引用[1][3]。" },
        { text: "参考文献", heading: 1 },
        { text: "[1] 张三. 文献一[J]. 学报, 2020." },
        { text: "[2] 李四. 文献二[M]. 出版社, 2021." },
      ],
    });
    const missing = r.issues.filter((i) => i.ruleId === "RR-CIT-001");
    expect(missing).toHaveLength(1);
    expect(missing[0]!.detail).toContain("3");
    // uncited entry [2] → info
    expect(r.issues.some((i) => i.ruleId === "RR-REF-011" && i.detail.includes("2"))).toBe(true);
  });

  it("supports version selection (2015 rejects DS codes)", () => {
    const doc: TestDoc = {
      paragraphs: [
        { text: "数据研究[1]。" },
        { text: "参考文献", heading: 1 },
        { text: "[1] 某中心. 数据集[DS/OL]. 平台, 2024-01-01[2025-01-01]. https://example.com." },
      ],
    };
    const as2015 = analyze(doc, "2015");
    const as2025 = analyze(doc, "2025");
    expect(as2015.issues.some((i) => i.ruleId === "RR-FMT-008")).toBe(true);
    expect(as2025.issues.some((i) => i.ruleId === "RR-FMT-008" && i.detail.includes("DS"))).toBe(false);
  });

  it("flags first-citation order violations", () => {
    const r = analyze({
      paragraphs: [
        { text: "先引[2]后引[1]。" },
        { text: "参考文献", heading: 1 },
        { text: "[1] 甲. 文一[J]. 学, 2020." },
        { text: "[2] 乙. 文二[J]. 学, 2021." },
      ],
    });
    expect(r.issues.some((i) => i.ruleId === "RR-CIT-004")).toBe(true);
  });

  it("handles documents without reference sections", () => {
    const r = analyze({
      paragraphs: [{ text: "只有正文引用[1]，没有文献表。" }],
    });
    expect(r.scope.referenceSectionDetected).toBe(false);
    expect(r.issues.some((i) => i.ruleId === "RR-SCOPE-012")).toBe(true);
  });

  it("links a citation to EVERY entry carrying a duplicate number (V1.1.2)", () => {
    const r = analyze({
      paragraphs: [
        { text: "引用[2]。" },
        { text: "参考文献", heading: 1 },
        { text: "[2] 甲. 文献A[J]. 学报, 2020." },
        { text: "[2] 乙. 文献B[M]. 出版社, 2021." },
      ],
    });
    const rels = r.relations.filter((x) => x.number === 2 && !x.missing);
    expect(rels).toHaveLength(2); // both duplicate entries stay connected
    expect(new Set(rels.map((x) => x.referenceId)).size).toBe(2);
  });

  it("does not misread table data numbers as citations", () => {
    const r = analyze({
      paragraphs: [{ text: "见表1。" }],
      tables: [[[[{ text: "组别[1,2]" }], [{ text: "样本量" }]]]],
    });
    // table citations with review flag must not create deterministic errors
    const deterministic = r.issues.filter((i) => i.severity === "error");
    expect(deterministic).toHaveLength(0);
  });
});
