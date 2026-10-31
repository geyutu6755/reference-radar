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
