/**
 * Bounded DOCX (ZIP) unpacking.
 *
 * Threat model: the bytes come from an untrusted file the user dropped in.
 * Every size a ZIP header *declares* is attacker-controlled, so declarations
 * are only ever used to reject input EARLIER — never as the ceiling. The real
 * bound is the running total of bytes fflate produces while inflating, checked
 * as each chunk arrives, with the archive fed in small slices so that crossing
 * a cap stops the work within one slice instead of after a full inflate.
 */
import { Unzip, UnzipInflate } from "fflate";
import { DocxLimitsError, LIMITS, validateEntryName } from "./limits";

/**
 * Caps an unpack run obeys. Structural (plain numbers) rather than the literal
 * type of LIMITS so a test can pass a smaller budget.
 */
export type UnpackCaps = { readonly [K in keyof typeof LIMITS]: number };

export interface UnpackedDocx {
  /** entry name → bytes (text entries are decoded later, on demand) */
  files: Map<string, Uint8Array>;
  totalUncompressed: number;
}

/**
 * The only parts the OOXML reader ever consumes. Everything else in a real
 * .docx — images, embedded fonts, themes, thumbnails — is enumerated and then
 * skipped without inflating it, which is both a resource bound and the reason
 * a 20 MB deck parses as fast as a text-only paper.
 */
const CONSUMED_PARTS = new Set([
  "[Content_Types].xml",
  "word/document.xml",
  "word/footnotes.xml",
  "word/endnotes.xml",
  "word/styles.xml",
  "word/numbering.xml",
  "word/_rels/document.xml.rels",
]);

/** Input is fed in slices so caps are enforced during inflation, not after. */
const FEED_SLICE_BYTES = 64 * 1024;

/** fflate hands out chunks we must not retain references to, so copy once. */
function joinChunks(chunks: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function corrupt(reason?: unknown): DocxLimitsError {
  const detail = reason instanceof Error && reason.message ? ` ${reason.message}` : "";
  return new DocxLimitsError(
    "corrupt-zip",
    `DOCX 压缩结构损坏，无法解包。 / The DOCX archive is corrupted.${detail}`
  );
}

export function unpackDocx(bytes: Uint8Array, caps: UnpackCaps = LIMITS): UnpackedDocx {
  // Declared sizes: a cheap pre-rejection for honest archives that are simply too big.
  prescanZipSizes(bytes, caps);

  const files = new Map<string, Uint8Array>();
  let total = 0;
  let entryCount = 0;
  let failure: DocxLimitsError | undefined;

  const unzipper = new Unzip();
  // fflate ships only the stored (method 0) decoder by default; DEFLATE (8) has
  // to be registered or every real .docx arrives as “unknown compression type”.
  unzipper.register(UnzipInflate);
  unzipper.onfile = (file) => {
    if (failure) return; // over budget already: stop inflating, report at the end
    entryCount++;
    if (entryCount > caps.maxEntries) {
      failure = new DocxLimitsError("too-many-entries", "ZIP 条目数量超出限制。 / Too many ZIP entries.");
      return;
    }
    try {
      validateEntryName(file.name);
    } catch (e) {
      failure = e instanceof DocxLimitsError ? e : corrupt();
      return;
    }
    if (!CONSUMED_PARTS.has(file.name)) return; // counted, validated, never inflated

    const chunks: Uint8Array[] = [];
    let entrySize = 0;
    file.ondata = (err, data, final) => {
      if (err) {
        failure ??= corrupt(err);
        return;
      }
      entrySize += data.length;
      if (entrySize > caps.maxEntryUncompressedBytes) {
        failure = new DocxLimitsError(
          "entry-too-large",
          `ZIP 内单个文件过大：${file.name} / Single ZIP entry too large: ${file.name}`
        );
        file.terminate?.();
        return; // refuse to buffer what we are rejecting
      }
      total += data.length;
      if (total > caps.maxTotalUncompressedBytes) {
        failure = new DocxLimitsError(
          "total-too-large",
          "解压后内容总量超出限制。 / Total decompressed size exceeds the limit."
        );
        file.terminate?.();
        return;
      }
      // Copy on receipt: the inflater may reuse the buffer it hands us, and a
      // retained view would be silently overwritten before assembly.
      chunks.push(data.slice());
      if (final) files.set(file.name, joinChunks(chunks, entrySize));
    };
    try {
      file.start();
    } catch (e) {
      failure ??= new DocxLimitsError(
        "corrupt-zip",
        `DOCX 使用了不支持的压缩方式或结构损坏。 / Unsupported compression method or corrupted archive. ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  };

  for (let offset = 0; offset < bytes.length; offset += FEED_SLICE_BYTES) {
    const end = Math.min(offset + FEED_SLICE_BYTES, bytes.length);
    try {
      unzipper.push(bytes.subarray(offset, end), end === bytes.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failure ??= /encrypt|password/i.test(msg)
        ? new DocxLimitsError(
            "encrypted",
            "文件已加密（受密码保护），暂不支持。 / The file is password-protected, which is not supported."
          )
        : corrupt();
      break;
    }
    if (failure) break; // at most one further slice of work, never the whole bomb
  }

  if (failure) throw failure;
  return { files, totalUncompressed: total };
}

const decoder = new TextDecoder("utf-8", { fatal: false });

/**
 * Pre-scan the ZIP central directory and reject archives whose consumed parts
 * already declare sizes over budget. This is an early-out only — `unpackDocx`
 * enforces the same caps against bytes actually produced, so lying headers
 * cannot buy unbounded inflation. Returns total declared bytes for consumed
 * parts, or undefined when the directory cannot be parsed (the streaming
 * unpacker then reports the damage).
 */
export function prescanZipSizes(bytes: Uint8Array, caps: UnpackCaps = LIMITS): number | undefined {
  // Locate End Of Central Directory (EOCD) signature 0x06054b50 from the end.
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const minEocd = Math.max(0, bytes.length - 66 - 65536);
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return undefined;
  const entryCount = dv.getUint16(eocd + 10, true);
  if (entryCount > caps.maxEntries) {
    throw new DocxLimitsError("too-many-entries", "ZIP 条目数量超出限制。 / Too many ZIP entries.");
  }
  let cdOffset = dv.getUint32(eocd + 16, true);
  let total = 0;
  for (let n = 0; n < entryCount; n++) {
    if (cdOffset + 46 > bytes.length || dv.getUint32(cdOffset, true) !== 0x02014b50) {
      return undefined; // malformed directory — let the streaming unpacker report it
    }
    const compressed = dv.getUint32(cdOffset + 20, true);
    const uncompressed = dv.getUint32(cdOffset + 24, true);
    const nameLen = dv.getUint16(cdOffset + 28, true);
    const extraLen = dv.getUint16(cdOffset + 30, true);
    const commentLen = dv.getUint16(cdOffset + 32, true);
    const name = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    cdOffset += 46 + nameLen + extraLen + commentLen;
    // Same allow-list that gates inflation below: a media-heavy paper is never
    // refused for the size of parts the reader cannot use.
    if (!CONSUMED_PARTS.has(name)) continue;
    if (uncompressed > caps.maxEntryUncompressedBytes) {
      throw new DocxLimitsError(
        "entry-too-large",
        `ZIP 内单个文件过大（声明 ${uncompressed} 字节）。 / Declared entry too large.`
      );
    }
    // Ratio is skipped for stored (compressed 0) and for streaming archives that
    // declare nothing; both are still caught by the caps applied while inflating.
    if (uncompressed > 0 && compressed > 0 && uncompressed / compressed > caps.maxCompressionRatio) {
      throw new DocxLimitsError(
        "zip-bomb",
        "压缩比异常，疑似 ZIP 炸弹。 / Abnormal compression ratio — possible ZIP bomb."
      );
    }
    total += uncompressed;
  }
  if (total > caps.maxTotalUncompressedBytes) {
    throw new DocxLimitsError(
      "total-too-large",
      "解压后内容总量超出限制。 / Total decompressed size exceeds the limit."
    );
  }
  return total;
}

/** Decode a ZIP text entry as UTF-8, enforcing the XML size cap. */
export function decodeXml(files: Map<string, Uint8Array>, name: string): string | undefined {
  const data = files.get(name);
  if (!data) return undefined;
  if (data.byteLength > LIMITS.maxXmlParseBytes) {
    throw new DocxLimitsError(
      "xml-too-large",
      `XML 部件过大：${name} / XML part too large: ${name}`
    );
  }
  return decoder.decode(data);
}
