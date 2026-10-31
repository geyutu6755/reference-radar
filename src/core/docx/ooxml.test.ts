import { describe, expect, it } from "vitest";
import { parseOoxml } from "./ooxml";
import { assembleBlocks } from "./blocks";
import { loadDocx } from "./load";
import { buildDocx, type TestDoc } from "../../testing/docx-builder";

function parse(doc: TestDoc): ReturnType<typeof loadDocx> {
  return loadDocx(buildDocx(doc));
}

describe("OOXML paragraph walk", () => {
  it("merges text across multiple runs", () => {
    const doc = parse({
      paragraphs: [{ runs: [{ text: "研究表明" }, { text: "该方法有效" }, { text: "[1]" }] }],
    });
    expect(doc.blocks[0]!.text).toBe("研究表明该方法有效[1]");
  });

  it("renders tabs and breaks", () => {
    const doc = parseOoxml({
      documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
        <w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r></w:p>
      </w:body></w:document>`,
    });
    const blocks = assembleBlocks(doc);
    expect(blocks[0]!.text).toBe("a\tb\nc");
  });

  it("keeps order of t/tab inside one run (preserveOrder)", () => {
    const doc = parseOoxml({
      documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
        <w:p><w:r><w:t>x</w:t><w:tab/><w:t>y</w:t></w:r></w:p>
      </w:body></w:document>`,
    });
    expect(assembleBlocks(doc)[0]!.text).toBe("x\ty");
  });

  it("excludes hidden text from visible text but notes it", () => {
    const doc = parseOoxml({
      documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
        <w:p><w:r><w:t>visible</w:t></w:r><w:r><w:rPr><w:vanish/></w:rPr><w:t>secret</w:t></w:r></w:p>
      </w:body></w:document>`,
    });
    const blocks = assembleBlocks(doc);
    expect(blocks[0]!.text).toBe("visible");
    expect(blocks[0]!.notes.some((n) => n.code === "hidden-text")).toBe(true);
  });

  it("excludes tracked deletions and notes insertions", () => {
    const doc = parseOoxml({
      documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
        <w:p><w:ins><w:r><w:t>new </w:t></w:r></w:ins><w:del><w:r><w:delText>old </w:delText></w:r></w:del><w:r><w:t>text</w:t></w:r></w:p>
      </w:body></w:document>`,
    });
    const blocks = assembleBlocks(doc);
    expect(blocks[0]!.text).toBe("new text");
    expect(blocks[0]!.notes.map((n) => n.code)).toContain("revised-insertion");
    expect(blocks[0]!.notes.map((n) => n.code)).toContain("revised-deletion");
  });

  it("uses field display text and detects Zotero fields", () => {
    const doc = parse({
      paragraphs: [
        {
          field: {
            instr: "ADDIN ZOTERO_ITEM CSL_CITATION {\"citationID\":\"x\"}",
            result: "[1]",
          },
        },
      ],
    });
    const blocks = doc.blocks;
    expect(blocks[0]!.text).toBe("[1]");
    expect(blocks[0]!.notes.some((n) => n.code === "zotero-field")).toBe(true);
    expect(blocks[0]!.notes.some((n) => n.code === "field-code")).toBe(true);
  });

  it("flags unresolved fields", () => {
    const doc = parse({
      paragraphs: [{ fieldUnresolved: "REF _Ref12345" }],
    });
    expect(doc.blocks[0]!.notes.some((n) => n.code === "field-result-unresolved")).toBe(true);
  });

  it("replaces math with placeholder and notes it", () => {
    const doc = parseOoxml({
      documentXml: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>
        <w:p><m:oMath><m:r><m:t>x+1</m:t></m:r></m:oMath><w:r><w:t>ok</w:t></w:r></w:p>
      </w:body></w:document>`,
    });
    const blocks = assembleBlocks(doc);
    expect(blocks[0]!.text).toBe("□ok");
    expect(blocks[0]!.notes.some((n) => n.code === "image-formula")).toBe(true);
  });

  it("parses table cells with stable ids", () => {
    const doc = parse({
      paragraphs: [{ text: "前文[1]" }],
      tables: [[[[{ text: "cell A [2]" }], [{ text: "cell B" }]]]],
    });
    const cell = doc.blocks.find((b) => b.containerKind === "table-cell")!;
    expect(cell.text).toBe("cell A [2]");
    expect(cell.containerId).toMatch(/^tbl0:r1:c1$/);
  });

  it("parses footnotes", () => {
    const doc = parse({
      paragraphs: [{ text: "正文" }],
      footnotes: [[{ text: "脚注内容[1]" }]],
    });
    const fn = doc.blocks.find((b) => b.containerKind === "footnote")!;
    expect(fn.text).toBe("脚注内容[1]");
    expect(fn.containerId).toBe("fn:1");
  });

  it("detects headings via outline level", () => {
    const doc = parse({
      paragraphs: [{ text: "第一章", heading: 1 }, { text: "正文" }],
    });
    expect(doc.blocks[0]!.kind).toBe("heading");
    expect(doc.blocks[0]!.headingLevel).toBe(1);
  });

  it("renders decimal auto numbering", () => {
    const doc = parse({
      paragraphs: [
        { text: "第一部分", numId: 1 },
        { text: "第二部分", numId: 1 },
      ],
      numbering: [{ numId: 1, abstractId: 7, levels: [{ ilvl: 0, fmt: "decimal", text: "%1." }] }],
    });
    expect(doc.blocks[0]!.numberingText).toBe("1.");
    expect(doc.blocks[1]!.numberingText).toBe("2.");
  });

  it("renders Chinese auto numbering and multi-level text", () => {
    const doc = parse({
      paragraphs: [
        { text: "甲", numId: 3 },
        { text: "乙", numId: 3 },
      ],
      numbering: [
        { numId: 3, abstractId: 1, levels: [{ ilvl: 0, fmt: "chineseCounting", text: "（%1）" }] },
      ],
    });
    expect(doc.blocks[0]!.numberingText).toBe("（一）");
    expect(doc.blocks[1]!.numberingText).toBe("（二）");
  });
});
