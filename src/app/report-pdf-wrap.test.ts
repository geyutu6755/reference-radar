/**
 * V1.1.2 P1: no line drawn into the PDF may exceed the printable width, for
 * any input — long URLs, DOIs, unbroken ASCII runs, CJK, and mixed text.
 *
 * wrap() only depends on font.widthOfTextAtSize, so CJK cases use a metric
 * stub (real Helvetica cannot encode CJK); ASCII cases use the real font.
 */
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { wrap } from "./report-pdf";

const CONTENT_W = 595.28 - 56 * 2;

async function helvetica(): Promise<PDFFont> {
  const pdf = await PDFDocument.create();
  return pdf.embedFont(StandardFonts.Helvetica);
}

/** Monospace-ish stub: every char is 0.5×size wide (CJK-like density). */
const stubFont = {
  widthOfTextAtSize: (t: string, size: number) => t.length * size * 0.5,
} as unknown as PDFFont;

describe("PDF line wrapping", () => {
  it("keeps every wrapped line within the content width for hostile ASCII inputs", async () => {
    const font = await helvetica();
    const size = 9.5;
    const inputs = [
      "https://example.org/" + "a".repeat(300),
      "DOI:10.1234/" + "z".repeat(200) + ".end",
      "https://doi.org/10.1002/" + "0470841559.ch1".repeat(30),
      "X".repeat(400),
      "https://kns.cnki.net/kcms/detail/detail.aspx?dbcode=CJFD&filename=JZYJ202403001&dbname=CJFDA&url=%3D%3Dx".repeat(3),
    ];
    for (const text of inputs) {
      const lines = wrap(text, font, size, CONTENT_W);
      expect(lines.length).toBeGreaterThan(1);
      for (const line of lines) {
        const width = font.widthOfTextAtSize(line, size);
        expect(width, `line too wide (${width}): ${line.slice(0, 60)}`).toBeLessThanOrEqual(CONTENT_W);
      }
      // word-break spaces are consumed by the line break (typographic norm);
      // every non-space character must survive
      expect(lines.join("").replace(/ /g, "")).toBe(text.replace(/ /g, ""));
    }
  });

  it("wraps unbroken CJK within a narrow column and keeps every character", () => {
    const text = "参考文献著录".repeat(80);
    const lines = wrap(text, stubFont, 10, 200);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect((stubFont as { widthOfTextAtSize: (t: string, s: number) => number }).widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(200);
    }
    expect(lines.join("")).toBe(text);
  });

  it("wraps mixed CJK/ASCII/long-URL content (real entry shape)", () => {
    const text =
      "彭守璋. 1901—2024年中国1km分辨率逐月降水量数据集[DS/OL]. 国家地球系统科学数据中心 (2025-07-07) [2025-07-15]. https://www.geodata.cn/data/datadetails.html?dataguid=17616998426346&docid=12345." +
      "x".repeat(120);
    const lines = wrap(text, stubFont, 9.5, CONTENT_W);
    for (const line of lines) {
      expect((stubFont as { widthOfTextAtSize: (t: string, s: number) => number }).widthOfTextAtSize(line, 9.5)).toBeLessThanOrEqual(CONTENT_W);
    }
    // word-break spaces may be consumed; every other character survives
    expect(lines.join("").replace(/ /g, "")).toBe(text.replace(/ /g, ""));
  });
});
