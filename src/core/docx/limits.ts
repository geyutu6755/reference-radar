/** Security limits for DOCX processing. Conservative defaults, all enforced. */
export const LIMITS = {
  /** Max compressed upload size (bytes): 20 MB. */
  maxCompressedBytes: 20 * 1024 * 1024,
  /** Max total decompressed size across all entries (bytes): 256 MB. */
  maxTotalUncompressedBytes: 256 * 1024 * 1024,
  /** Max size of a single decompressed entry (bytes): 64 MB. */
  maxEntryUncompressedBytes: 64 * 1024 * 1024,
  /** Max number of ZIP entries. */
  maxEntries: 20_000,
  /** Max decompressed XML we will hand to the parser in one file (bytes). */
  maxXmlParseBytes: 64 * 1024 * 1024,
  /** Compression ratio threshold: entry claims to decompress beyond this × compressed → reject. */
  maxCompressionRatio: 1000,
} as const;

export class DocxLimitsError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DocxLimitsError";
    this.code = code;
  }
}

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

/**
 * Validate raw file bytes before any decompression work.
 * Throws DocxLimitsError with a user-facing code on violation.
 */
export function validateUpload(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) {
    throw new DocxLimitsError("empty-file", "文件为空 / The file is empty.");
  }
  if (bytes.byteLength > LIMITS.maxCompressedBytes) {
    throw new DocxLimitsError(
      "too-large",
      `文件超过大小限制（${Math.round(LIMITS.maxCompressedBytes / 1024 / 1024)} MB）。` +
        ` / The file exceeds the ${Math.round(LIMITS.maxCompressedBytes / 1024 / 1024)} MB limit.`
    );
  }
  // Legacy .doc (OLE2 compound file) — not a ZIP container.
  if (
    bytes.length >= 8 &&
    OLE_MAGIC.every((b, i) => bytes[i] === b)
  ) {
    throw new DocxLimitsError(
      "legacy-doc",
      "这是旧版 .doc 格式，请先用 Word 另存为 .docx。 / This is a legacy .doc file; re-save it as .docx first."
    );
  }
  // ZIP local file header magic "PK\x03\x04".
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new DocxLimitsError(
      "not-docx",
      "不是有效的 DOCX（ZIP）文件。 / Not a valid DOCX (ZIP) file."
    );
  }
}

/**
 * Check a single ZIP entry name for malicious paths / control characters.
 * Throws on violation.
 */
export function validateEntryName(name: string): void {
  if (name.length === 0 || name.length > 1024) {
    throw new DocxLimitsError("bad-entry-name", "ZIP 内文件名非法。 / Illegal ZIP entry name.");
  }
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) {
      throw new DocxLimitsError("bad-entry-name", "ZIP 内文件名包含控制字符。 / Control character in ZIP entry name.");
    }
  }
  const lower = name.toLowerCase();
  if (
    lower.startsWith("/") ||
    lower.startsWith("\\") ||
    lower.includes("..") ||
    /^[a-z]:/.test(lower)
  ) {
    throw new DocxLimitsError("bad-entry-name", "ZIP 内文件名包含路径穿越。 / Path traversal in ZIP entry name.");
  }
}
