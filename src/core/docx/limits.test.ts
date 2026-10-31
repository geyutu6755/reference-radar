import { describe, expect, it } from "vitest";
import { DocxLimitsError, validateEntryName, validateUpload } from "./limits";

const PK_HEADER = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);

describe("upload validation", () => {
  it("rejects empty files", () => {
    expect(() => validateUpload(new Uint8Array(0))).toThrow(DocxLimitsError);
    try {
      validateUpload(new Uint8Array(0));
    } catch (e) {
      expect((e as DocxLimitsError).code).toBe("empty-file");
    }
  });

  it("rejects legacy .doc (OLE2)", () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    try {
      validateUpload(ole);
      expect.unreachable();
    } catch (e) {
      expect((e as DocxLimitsError).code).toBe("legacy-doc");
    }
  });

  it("rejects non-ZIP bytes", () => {
    expect(() => validateUpload(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(DocxLimitsError);
  });

  it("accepts a ZIP header", () => {
    expect(() => validateUpload(PK_HEADER)).not.toThrow();
  });
});

describe("zip entry name validation", () => {
  it("rejects path traversal", () => {
    expect(() => validateEntryName("../evil.xml")).toThrow(DocxLimitsError);
    expect(() => validateEntryName("a/../../b.xml")).toThrow(DocxLimitsError);
  });

  it("rejects absolute and drive paths", () => {
    expect(() => validateEntryName("/etc/passwd")).toThrow(DocxLimitsError);
    expect(() => validateEntryName("C:evil.xml")).toThrow(DocxLimitsError);
  });

  it("rejects control characters", () => {
    expect(() => validateEntryName("bad\u0000name.xml")).toThrow(DocxLimitsError);
  });

  it("accepts normal names", () => {
    expect(() => validateEntryName("word/document.xml")).not.toThrow();
    expect(() => validateEntryName("字/档.xml")).not.toThrow();
  });
});
