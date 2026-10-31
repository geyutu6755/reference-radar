import { describe, expect, it } from "vitest";
import { extractCitations, parseCitationContent } from "./citations";
import type { DocBlock } from "../types";

function block(text: string, overrides: Partial<DocBlock> = {}): DocBlock {
  return {
    id: "body#body:p0",
    kind: "paragraph",
    text,
    containerId: "body",
    containerKind: "body",
    blockIndex: 0,
    region: "body",
    notes: [],
    ...overrides,
  };
}

describe("citation content parsing", () => {
  it("expands ranges into explicit numbers", () => {
    expect(parseCitationContent("2-4", 0).numbers).toEqual([2, 3, 4]);
    expect(parseCitationContent("1,3-5", 0).numbers).toEqual([1, 3, 4, 5]);
  });

  it("handles Chinese separators and dashes", () => {
    expect(parseCitationContent("1，3—5", 0).numbers).toEqual([1, 3, 4, 5]);
    expect(parseCitationContent("2～4", 0).numbers).toEqual([2, 3, 4]);
  });

  it("marks inverted ranges invalid but keeps segments", () => {
    const r = parseCitationContent("5-2", 0);
    expect(r.invalid).toBe(true);
    expect(r.segments[0]).toMatchObject({ kind: "range", start: 5, end: 2 });
  });
});

describe("citation extraction", () => {
  it("extracts single and multiple markers", () => {
    const r = extractCitations([block("前人研究[1]表明，另有研究[2,5]认为。")]);
    expect(r.citations).toHaveLength(2);
    expect(r.citations[0]!.raw).toBe("[1]");
    expect(r.citations[1]!.numbers).toEqual([2, 5]);
  });

  it("supports full-width brackets and mixed separators", () => {
    const r = extractCitations([block("结果［1，3—5］如下。")]);
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0]!.raw).toBe("［1，3—5］");
    expect(r.citations[0]!.numbers).toEqual([1, 3, 4, 5]);
  });

  it("handles adjacent consecutive markers", () => {
    const r = extractCitations([block("研究[1][2]显示。")]);
    expect(r.citations).toHaveLength(2);
  });

  it("skips headings", () => {
    const r = extractCitations([block("第[1]章", { kind: "heading", headingLevel: 1 })]);
    expect(r.citations).toHaveLength(0);
  });

  it("skips the reference list region", () => {
    const r = extractCitations([block("[1] 张三. 某文[J]. 学报, 2020.", { region: "references" })]);
    expect(r.citations).toHaveLength(0);
  });

  it("flags math-adjacent brackets for review", () => {
    const r = extractCitations([block("向量 x=[1,2] 满足条件。")]);
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0]!.detection.needsReview).toBe(true);
    expect(r.citations[0]!.detection.signals).toContain("math-adjacent");
  });

  it("treats short lone bracket cells in tables as review", () => {
    const r = extractCitations([block("[1,2]", { containerKind: "table-cell" })]);
    expect(r.citations[0]!.detection.needsReview).toBe(true);
  });

  it("detects superscript as strong signal", () => {
    const b = block("实验结果[3]证明。");
    b.spans = [{ start: 4, end: 7, flags: { superscript: true } }];
    const r = extractCitations([b]);
    expect(r.citations[0]!.detection.signals).toContain("superscript");
    expect(r.citations[0]!.detection.confidence).toBe("high");
  });

  it("does not extract decimals or vectors", () => {
    expect(extractCitations([block("向量 [0.5, 0.8] 表示。")]).citations).toHaveLength(0);
    expect(extractCitations([block("数组 [1 2 3] 排列。")]).citations).toHaveLength(0);
  });

  it("detects entry-like paragraphs as reference candidates", () => {
    const r = extractCitations([
      block("[1] 张三. 某某研究论文[J]. 某学报, 2020, 15(2): 12-18. 这是一个很长的文献条目内容。"),
    ]);
    expect(r.citations).toHaveLength(0);
    expect(r.entryLike).toEqual([0]);
  });

  it("tracks first occurrences across markers", () => {
    const r = extractCitations([block("甲[1]。乙[2]。又见甲[1]。")]);
    expect(r.citations[2]!.isFirstOccurrenceOf).toEqual([]);
    expect(r.citations[0]!.isFirstOccurrenceOf).toEqual([1]);
  });
});
