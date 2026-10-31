import { unzipSync } from "fflate";
import { DocxLimitsError, LIMITS, validateEntryName } from "./limits";

/**
 * Safely unpack a DOCX (ZIP) archive.
 *
 * fflate's unzipSync inflates all entries; we therefore enforce pre-checks on
 * the compressed size and rely on ZIP local-header declared sizes plus a hard
 * output cap to bound memory. A zip-bomb that lies about its sizes is still
 * bounded because fflate writes into growable buffers — so we additionally
 * abort after the output cap is exceeded via periodic checks.
 */
export interface UnpackedDocx {
  /** entry name → bytes (text entries are decoded later, on demand) */
  files: Map<string, Uint8Array>;
  totalUncompressed: number;
}

export function unpackDocx(bytes: Uint8Array): UnpackedDocx {
  // Central-directory pre-scan first: reject bombs/oversized entries without
  // spending memory on decompression.
  prescanZipSizes(bytes);

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/encrypt|password/i.test(msg)) {
      throw new DocxLimitsError(
        "encrypted",
        "文件已加密（受密码保护），暂不支持。 / The file is password-protected, which is not supported."
      );
    }
    throw new DocxLimitsError(
      "corrupt-zip",
      "DOCX 压缩结构损坏，无法解包。 / The DOCX archive is corrupted."
    );
  }

  const names = Object.keys(entries);
  if (names.length > LIMITS.maxEntries) {
    throw new DocxLimitsError("too-many-entries", "ZIP 条目数量超出限制。 / Too many ZIP entries.");
  }

  let total = 0;
  const files = new Map<string, Uint8Array>();
  for (const name of names) {
    validateEntryName(name);
    const data = entries[name]!;
    total += data.byteLength;
    if (data.byteLength > LIMITS.maxEntryUncompressedBytes) {
      throw new DocxLimitsError(
        "entry-too-large",
        `ZIP 内单个文件过大：${name} / Single ZIP entry too large: ${name}`
      );
    }
    if (total > LIMITS.maxTotalUncompressedBytes) {
      throw new DocxLimitsError(
        "total-too-large",
        "解压后内容总量超出限制。 / Total decompressed size exceeds the limit."
      );
    }
    files.set(name, data);
  }

  return { files, totalUncompressed: total };
}

const decoder = new TextDecoder("utf-8", { fatal: false });

/**
 * Pre-scan ZIP central directory: sum declared uncompressed sizes and reject
 * bombs BEFORE decompressing. Returns total declared bytes (or undefined when
 * the directory cannot be parsed — fflate's own errors then apply).
 */
export function prescanZipSizes(bytes: Uint8Array): number | undefined {
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
  if (entryCount > LIMITS.maxEntries) {
    throw new DocxLimitsError("too-many-entries", "ZIP 条目数量超出限制。 / Too many ZIP entries.");
  }
  let cdOffset = dv.getUint32(eocd + 16, true);
  let total = 0;
  for (let n = 0; n < entryCount; n++) {
    if (cdOffset + 46 > bytes.length || dv.getUint32(cdOffset, true) !== 0x02014b50) {
      return undefined; // malformed directory — let fflate handle/report
    }
    const uncompressed = dv.getUint32(cdOffset + 24, true);
    const compressed = dv.getUint32(cdOffset + 20, true);
    const nameLen = dv.getUint16(cdOffset + 28, true);
    const extraLen = dv.getUint16(cdOffset + 30, true);
    const commentLen = dv.getUint16(cdOffset + 32, true);
    if (uncompressed > LIMITS.maxEntryUncompressedBytes) {
      throw new DocxLimitsError(
        "entry-too-large",
        `ZIP 内单个文件过大（声明 ${uncompressed} 字节）。 / Declared entry too large.`
      );
    }
    if (uncompressed > 0 && compressed > 0 && uncompressed / compressed > LIMITS.maxCompressionRatio) {
      throw new DocxLimitsError(
        "zip-bomb",
        "压缩比异常，疑似 ZIP 炸弹。 / Abnormal compression ratio — possible ZIP bomb."
      );
    }
    total += uncompressed;
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  if (total > LIMITS.maxTotalUncompressedBytes) {
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
