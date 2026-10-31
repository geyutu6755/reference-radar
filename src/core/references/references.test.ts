import { describe, expect, it } from "vitest";
import { detectReferenceSection, applyReferenceRegion } from "./detect";
import { parseReferenceEntries } from "./parse";
import { extractFields } from "./fields";
import type { DocBlock } from "../types";

function block(text: string, overrides: Partial<DocBlock> = {}): DocBlock {
  return {
    id: `body#body:p${overrides.blockIndex ?? 0}`,
    kind: "paragraph",
    text,
    containerId: "body",
    containerKind: "body",
    blockIndex: overrides.blockIndex ?? 0,
    region: "body",
    notes: [],
    ...overrides,
  };
}

function refDoc(): DocBlock[] {
  return [
    block("引言内容[1]。", { blockIndex: 0 }),
    block("方法内容[2]。", { blockIndex: 1 }),
    block("参考文献", { blockIndex: 2, kind: "heading", headingLevel: 1 }),
    block("[1] 张三. 某某研究[J]. 某学报, 2020, 15(2): 12-18.", { blockIndex: 3 }),
    block("[2] 李四. 另一研究[M]. 北京: 某出版社, 2019.", { blockIndex: 4 }),
    block("致谢", { blockIndex: 5, kind: "heading", headingLevel: 1 }),
    block("感谢所有人。", { blockIndex: 6 }),
  ];
}

describe("reference section detection", () => {
  it("finds a heading followed by entries", () => {
    const blocks = refDoc();
    const s = detectReferenceSection(blocks);
    expect(s).toBeDefined();
    expect(s!.startIndex).toBe(2);
    applyReferenceRegion(blocks, s!);
    expect(blocks[3]!.region).toBe("references");
    expect(blocks[6]!.region).toBe("body"); // after 致谢
  });

  it("falls back to entry-run without heading", () => {
    const blocks = [
      block("正文段落，内容较长。".repeat(20), { blockIndex: 0 }),
      block("[1] 张三. 文献一[J]. 学报, 2020.", { blockIndex: 1 }),
      block("[2] 李四. 文献二[M]. 出版社, 2021.", { blockIndex: 2 }),
      block("[3] 王五. 文献三[D]. 大学, 2022.", { blockIndex: 3 }),
    ];
    const s = detectReferenceSection(blocks);
    expect(s).toBeDefined();
    expect(s!.evidence).toBe("entries-run");
  });
});

describe("reference entry parsing", () => {
  it("parses manual numbers and strips labels", () => {
    const blocks = refDoc();
    const { entries } = parseReferenceEntries(blocks, 3, 4);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.index).toBe(1);
    expect(entries[0]!.displayNumber).toBe("[1]");
    expect(entries[0]!.raw).toBe("张三. 某某研究[J]. 某学报, 2020, 15(2): 12-18.");
    expect(entries[1]!.index).toBe(2);
  });

  it("parses auto-numbered entries", () => {
    const blocks = [
      block("张三. 文献一[J]. 学报, 2020.", { blockIndex: 0, numberingText: "[1]" }),
      block("李四. 文献二[M]. 出版社, 2021.", { blockIndex: 1, numberingText: "[2]" }),
    ];
    const { entries } = parseReferenceEntries(blocks, 0, 1);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.numberingKind).toBe("auto");
    expect(entries[0]!.index).toBe(1);
  });

  it("merges multi-paragraph entries", () => {
    const blocks = [
      block("[1] 张三. 很长的文献题名一部分，", { blockIndex: 0 }),
      block("续行内容[M]. 出版社, 2020.", { blockIndex: 1 }),
      block("[2] 李四. 另一条[D]. 大学, 2021.", { blockIndex: 2 }),
    ];
    const { entries, continuationBlocks } = parseReferenceEntries(blocks, 0, 2);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.raw).toContain("续行内容");
    expect(continuationBlocks).toEqual([1]);
    expect(entries[1]!.index).toBe(2);
  });
});

describe("bibliographic field extraction", () => {
  it("extracts journal fields with high confidence", () => {
    const r = extractFields("张三, 李四. 某某方法研究[J]. 某学报, 2020, 15(2): 12-18.");
    expect(r.fields.typeCode).toBe("J");
    expect(r.fields.year).toBe("2020");
    expect(r.fields.volume).toBe("15");
    expect(r.fields.issue).toBe("2");
    expect(r.fields.pages).toBe("12-18");
    expect(r.fields.authors).toContain("张三");
    expect(r.fields.title).toContain("某某方法研究");
    expect(["high", "medium"]).toContain(r.confidence);
  });

  it("extracts DOI, URL and cited date from online entries", () => {
    const r = extractFields("王五. 在线资源[EB/OL]. (2021-03-01)[2024-01-15]. https://example.com/page. DOI: 10.1234/abc.5678.");
    expect(r.fields.typeCode).toBe("EB");
    expect(r.fields.carrierCode).toBe("OL");
    expect(r.fields.citedDate).toBe("2024-01-15");
    expect(r.fields.url).toContain("example.com");
    expect(r.fields.doi).toBe("10.1234/abc.5678");
  });

  it("keeps low confidence on unparseable entries", () => {
    const r = extractFields("一些无法解析的文字内容没有结构信息");
    expect(r.confidence).toBe("low");
  });
});
