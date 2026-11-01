/**
 * Decompression boundary tests (V1.1.1).
 *
 * These assert the property that matters: the caps are applied to bytes the
 * inflater actually produces, so an archive whose headers lie cannot buy
 * unbounded work. Payloads stay deliberately small — the point is the bound,
 * not provoking a real out-of-memory condition.
 */
import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { prescanZipSizes, unpackDocx } from "./unzip";
import { DocxLimitsError, LIMITS } from "./limits";

const caps = (over: Partial<typeof LIMITS>): typeof LIMITS => ({ ...LIMITS, ...over });

/**
 * Rewrite the declared uncompressed sizes (local headers + central directory)
 * to `value`, leaving the deflate stream itself untouched. This is exactly the
 * class of archive a size-based pre-check cannot be trusted against.
 */
function lieAboutSizes(zip: Uint8Array, value = 1): Uint8Array {
  const out = zip.slice(); // copy — never mutate the sample
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);

  for (let i = 0; i + 30 <= out.length; ) {
    if (dv.getUint32(i, true) !== 0x04034b50) break; // local file header
    dv.setUint32(i + 22, value, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const compLen = dv.getUint32(i + 18, true);
    i += 30 + nameLen + extraLen + compLen;
  }

  let eocd = -1;
  for (let i = out.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd >= 0) {
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      dv.setUint32(off + 24, value, true);
      off += 46 + dv.getUint16(off + 28, true) + dv.getUint16(off + 30, true) + dv.getUint16(off + 32, true);
    }
  }
  return out;
}

const bigPart = (n: number): Uint8Array => strToU8("<a/>".repeat(n)); // ~250 KB, compresses hard

/** Body-like content: large, but not compressible enough to look like a bomb. */
function variedPart(paragraphs: number): Uint8Array {
  const out: string[] = [];
  for (let i = 0; i < paragraphs; i++) {
    out.push(`<w:p>第${i}段：研究编号${((i * 2654435761) % 9973).toString(36)}，样本量${(i % 97) * (i % 31)}。</w:p>`);
  }
  return strToU8(out.join(""));
}

function docxLike(extra: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8("<w:document><w:body/><w:document>"),
    ...extra,
  });
}

describe("caps are enforced on produced bytes, not on declarations", () => {
  it("rejects an archive whose headers claim a tiny uncompressed size", () => {
    const lying = lieAboutSizes(docxLike({ "word/document.xml": bigPart(62_500) }));
    // The declaration now says ~1 byte: a header-trusting guard would accept it.
    expect(() => prescanZipSizes(lying, caps({ maxEntryUncompressedBytes: 1024 }))).not.toThrow();
    expect(() => unpackDocx(lying, caps({ maxEntryUncompressedBytes: 4096 }))).toThrowError(DocxLimitsError);
    try {
      unpackDocx(lying, caps({ maxEntryUncompressedBytes: 4096 }));
      expect.unreachable("lying archive should be rejected");
    } catch (e) {
      expect(e).toBeInstanceOf(DocxLimitsError);
      expect((e as DocxLimitsError).code).toBe("entry-too-large");
    }
  });

  it("bounds the cumulative output across several parts", () => {
    const lying = lieAboutSizes(
      docxLike({
        "word/document.xml": bigPart(20_000),
        "word/styles.xml": bigPart(20_000),
        "word/numbering.xml": bigPart(20_000),
      })
    );
    try {
      unpackDocx(lying, caps({ maxTotalUncompressedBytes: 20_000 }));
      expect.unreachable("total cap should trip");
    } catch (e) {
      expect((e as DocxLimitsError).code).toBe("total-too-large");
    }
  });

  it("bounds stored (uncompressed) entries too, not just deflated ones", () => {
    // level 0 → no compression, so the header cannot “look” suspicious and the
    // ratio guard has nothing to say; only the running total can stop it.
    const stored = lieAboutSizes(zipSync({ "word/document.xml": bigPart(62_500) }, { level: 0 }));
    try {
      unpackDocx(stored, caps({ maxEntryUncompressedBytes: 32_768 }));
      expect.unreachable("stored entry should still hit the cap");
    } catch (e) {
      expect((e as DocxLimitsError).code).toBe("entry-too-large");
    }
  });
});

describe("archive-level controls", () => {
  it("counts and refuses an entry storm", () => {
    const many = zipSync(
      Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`word/p${i}.xml`, strToU8(`<x/>`)])
      )
    );
    try {
      unpackDocx(many, caps({ maxEntries: 5 }));
      expect.unreachable("entry storm should be refused");
    } catch (e) {
      expect((e as DocxLimitsError).code).toBe("too-many-entries");
    }
  });

  it("rejects a traversal entry name before inflating anything", () => {
    // Sizes lie so the declared-size pre-check cannot be what saves us, and
    // document.xml would blow the cap if it were inflated: the name check fires first.
    const evil = lieAboutSizes(zipSync({ "../evil.xml": strToU8("<x/>"), "word/document.xml": bigPart(50_000) }));
    try {
      unpackDocx(evil, caps({ maxEntryUncompressedBytes: 1024 }));
      expect.unreachable("traversal name should be refused");
    } catch (e) {
      expect((e as DocxLimitsError).code).toBe("bad-entry-name");
    }
  });

  it("never inflates parts the reader cannot use", () => {
    // A 250 KB image payload would be buffered by an everything-first unpacker.
    const withMedia = docxLike({ "word/media/image1.png": bigPart(62_500) });
    const result = unpackDocx(withMedia, caps({ maxEntryUncompressedBytes: 1024, maxTotalUncompressedBytes: 4096 }));
    expect(result.files.has("word/media/image1.png")).toBe(false);
    expect(result.files.has("word/document.xml")).toBe(true);
    expect(result.totalUncompressed).toBeLessThan(4096);
  });

  it("never returns a silently truncated part", () => {
    // Poorly compressible body, cut mid-stream: the deflate data cannot finish.
    const payload = variedPart(20_000);
    const whole = docxLike({ "word/document.xml": payload });
    const truncated = whole.subarray(0, Math.floor(whole.length * 0.3));
    let produced: ReturnType<typeof unpackDocx> | undefined;
    let thrown: unknown;
    try {
      produced = unpackDocx(truncated);
    } catch (e) {
      thrown = e;
    }
    if (thrown) {
      expect(thrown).toBeInstanceOf(DocxLimitsError);
    } else {
      // The only acceptable non-error outcome: an unfinished part is absent, so
      // the loader reports it instead of parsing half a document.
      expect(produced!.files.has("word/document.xml")).toBe(false);
    }
  });
});

describe("valid documents still unpack", () => {
  it("reads the parts the OOXML parser consumes", () => {
    const doc = docxLike({ "word/footnotes.xml": strToU8("<footnotes/>") });
    const result = unpackDocx(doc);
    expect(result.files.has("word/document.xml")).toBe(true);
    expect(result.files.has("word/footnotes.xml")).toBe(true);
    expect(result.files.has("[Content_Types].xml")).toBe(true);
    expect(result.totalUncompressed).toBeGreaterThan(0);
  });

  it("handles a large legitimate document within the default caps", () => {
    const payload = variedPart(30_000); // >1 MB of body-like XML, ratio well under the guard
    const large = docxLike({ "word/document.xml": payload });
    const result = unpackDocx(large);
    expect(payload.byteLength).toBeGreaterThan(1_000_000);
    // Round-trip must be exact: no truncation, no reordering of chunks.
    const got = result.files.get("word/document.xml")!;
    expect(got.byteLength).toBe(payload.byteLength);
    // Byte-by-byte: an assembled stream must be identical, in chunk order.
    let diff = -1;
    for (let i = 0; i < payload.length; i++) {
      if (got[i] !== payload[i]) {
        diff = i;
        break;
      }
    }
    expect(diff).toBe(-1);
  });
});
