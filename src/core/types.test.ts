import { describe, expect, it } from "vitest";
import type { Citation, ReferenceEntry } from "./types";

describe("core domain model", () => {
  it("represents a citation with expanded range numbers", () => {
    const c: Citation = {
      id: "c1",
      raw: "[2-4]",
      numbers: [2, 3, 4],
      segments: [{ kind: "range", start: 2, end: 4, rawStart: 1, rawEnd: 4 }],
      anchor: {
        containerId: "body",
        containerKind: "body",
        paragraphId: "body:p3",
        blockIndex: 3,
        charStart: 10,
        charEnd: 15,
        text: "[2-4]",
      },
      contextBefore: "研究表明",
      contextAfter: "。",
      order: 0,
      isFirstOccurrenceOf: [2, 3, 4],
      detection: { confidence: "high", signals: ["body-paragraph"], needsReview: false },
    };
    expect(c.numbers).toEqual([2, 3, 4]);
  });

  it("represents a reference entry with fields", () => {
    const r: ReferenceEntry = {
      id: "r1",
      index: 1,
      displayNumber: "[1]",
      numberingKind: "manual",
      raw: "张三. 论文题目[J]. 期刊名, 2024, 12(3): 45-50.",
      fields: { typeCode: "J", year: "2024" },
      fieldsConfidence: "high",
      anchor: {
        containerId: "body",
        containerKind: "body",
        paragraphId: "body:p40",
        blockIndex: 40,
        charStart: 0,
        charEnd: 30,
        text: "[1] 张三. 论文题目[J]. 期刊名, 2024, 12(3): 45-50.",
      },
      notes: [],
    };
    expect(r.index).toBe(1);
    expect(r.fields.typeCode).toBe("J");
  });
});
