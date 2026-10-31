/**
 * DOCX loading facade: bytes → parsed document.
 */
import { decodeXml, unpackDocx } from "./unzip";
import { parseOoxml } from "./ooxml";
import { assembleBlocks } from "./blocks";
import { validateUpload, DocxLimitsError } from "./limits";
import type { DocBlock } from "../types";

export interface LoadedDocument {
  blocks: DocBlock[];
  /** names of parts present */
  parts: {
    document: boolean;
    footnotes: boolean;
    endnotes: boolean;
    styles: boolean;
    numbering: boolean;
  };
  warnings: string[];
}

// eslint-disable-next-line no-control-regex -- intentional: strip XML-illegal control chars
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export function loadDocx(bytes: Uint8Array): LoadedDocument {
  validateUpload(bytes);
  const { files } = unpackDocx(bytes);

  const documentXml = decodeXml(files, "word/document.xml");
  if (!documentXml) {
    throw new DocxLimitsError(
      "missing-document-xml",
      "缺少 word/document.xml，不是有效的 Word 文档。 / word/document.xml is missing — not a valid Word document."
    );
  }

  const parsed = parseOoxml({
    documentXml: documentXml.replace(CONTROL_CHARS, ""),
    footnotesXml: decodeXml(files, "word/footnotes.xml")?.replace(CONTROL_CHARS, ""),
    endnotesXml: decodeXml(files, "word/endnotes.xml")?.replace(CONTROL_CHARS, ""),
    stylesXml: decodeXml(files, "word/styles.xml")?.replace(CONTROL_CHARS, ""),
    numberingXml: decodeXml(files, "word/numbering.xml")?.replace(CONTROL_CHARS, ""),
    documentRelsXml: decodeXml(files, "word/_rels/document.xml.rels")?.replace(CONTROL_CHARS, ""),
  });

  const blocks = assembleBlocks(parsed);
  return {
    blocks,
    parts: {
      document: true,
      footnotes: files.has("word/footnotes.xml"),
      endnotes: files.has("word/endnotes.xml"),
      styles: files.has("word/styles.xml"),
      numbering: files.has("word/numbering.xml"),
    },
    warnings: parsed.warnings,
  };
}
