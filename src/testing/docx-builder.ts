/**
 * Test helper: programmatically build minimal DOCX (OOXML) files as bytes.
 * Used by unit tests and golden samples — full control, no Word required.
 */
import { zipSync, strToU8 } from "fflate";

export interface TestRun {
  text: string;
  superscript?: boolean;
  hidden?: boolean;
  bold?: boolean;
}

export interface TestParagraph {
  runs?: TestRun[];
  text?: string;
  heading?: number;
  style?: string;
  numId?: number;
  ilvl?: number;
  /** Simple field: instruction + displayed result. */
  field?: { instr: string; result: string };
  fieldUnresolved?: string; // field with no separate/result
}

export interface TestDoc {
  paragraphs: TestParagraph[];
  /** tables[t] → rows[r] → cells[c] → paragraphs[p] */
  tables?: Array<Array<Array<Array<TestParagraph>>>>;
  footnotes?: TestParagraph[][];
  endnotes?: TestParagraph[][];
  styles?: Array<{ id: string; name: string }>;
  numbering?: Array<{ numId: number; abstractId: number; levels: Array<{ ilvl: number; fmt: string; text: string; start?: number }> }>;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function runXml(r: TestRun): string {
  const rPr: string[] = [];
  if (r.superscript) rPr.push('<w:vertAlign w:val="superscript"/>');
  if (r.hidden) rPr.push('<w:vanish/>');
  if (r.bold) rPr.push('<w:b/>');
  const rPrXml = rPr.length > 0 ? `<w:rPr>${rPr.join("")}</w:rPr>` : "";
  return `<w:r>${rPrXml}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

function paraXml(p: TestParagraph): string {
  const pPr: string[] = [];
  if (p.heading !== undefined) pPr.push(`<w:outlineLvl w:val="${p.heading - 1}"/>`);
  if (p.style) pPr.push(`<w:pStyle w:val="${esc(p.style)}"/>`);
  if (p.numId !== undefined) {
    pPr.push(`<w:numPr><w:ilvl w:val="${p.ilvl ?? 0}"/><w:numId w:val="${p.numId}"/></w:numPr>`);
  }
  const pPrXml = pPr.length > 0 ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  let body = "";
  if (p.field) {
    body +=
      `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
      `<w:r><w:instrText xml:space="preserve"> ${esc(p.field.instr)} </w:instrText></w:r>` +
      `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
      `<w:r><w:t xml:space="preserve">${esc(p.field.result)}</w:t></w:r>` +
      `<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  } else if (p.fieldUnresolved !== undefined) {
    body +=
      `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
      `<w:r><w:instrText xml:space="preserve"> ${esc(p.fieldUnresolved)} </w:instrText></w:r>` +
      `<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  } else if (p.runs) {
    body = p.runs.map(runXml).join("");
  } else if (p.text !== undefined) {
    body = runXml({ text: p.text });
  }
  return `<w:p>${pPrXml}${body}</w:p>`;
}

function tableXml(rows: Array<Array<Array<TestParagraph>>>): string {
  const trs = rows
    .map(
      (cells) =>
        `<w:tr>${cells
          .map(
            (paras) =>
              `<w:tc><w:tcPr/>${paras.map(paraXml).join("")}</w:tc>`
          )
          .join("")}</w:tr>`
    )
    .join("");
  return `<w:tbl><w:tblPr/><w:tblGrid/>${trs}</w:tbl>`;
}

function notesXml(entries: Array<Array<TestParagraph>>, tag: "footnote" | "endnote"): string {
  const plural = tag === "footnote" ? "footnotes" : "endnotes";
  const items = entries
    .map((paras, i) => `<w:${tag} w:id="${i + 1}">${paras.map(paraXml).join("")}</w:${tag}>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${plural} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${items}</w:${plural}>`;
}

function stylesXml(styles: Array<{ id: string; name: string }>): string {
  const items = styles
    .map(
      (s) =>
        `<w:style w:type="paragraph" w:styleId="${esc(s.id)}"><w:name w:val="${esc(s.name)}"/></w:style>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${items}</w:styles>`;
}

function numberingXml(defs: NonNullable<TestDoc["numbering"]>): string {
  const abstracts = defs
    .map(
      (d) =>
        `<w:abstractNum w:abstractNumId="${d.abstractId}">${d.levels
          .map(
            (l) =>
              `<w:lvl w:ilvl="${l.ilvl}"><w:start w:val="${l.start ?? 1}"/><w:numFmt w:val="${l.fmt}"/><w:lvlText w:val="${esc(l.text)}"/></w:lvl>`
          )
          .join("")}</w:abstractNum>`
    )
    .join("");
  const nums = defs.map((d) => `<w:num w:numId="${d.numId}"><w:abstractNumId w:val="${d.abstractId}"/></w:num>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${abstracts}${nums}</w:numbering>`;
}

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

export function buildDocx(doc: TestDoc): Uint8Array {
  const bodyParts: string[] = [];
  for (const p of doc.paragraphs) bodyParts.push(paraXml(p));
  for (const t of doc.tables ?? []) bodyParts.push(tableXml(t));
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${bodyParts.join("")}<w:sectPr/></w:body></w:document>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`
    ),
    "word/document.xml": strToU8(documentXml),
  };
  if (doc.footnotes) files["word/footnotes.xml"] = strToU8(notesXml(doc.footnotes, "footnote"));
  if (doc.endnotes) files["word/endnotes.xml"] = strToU8(notesXml(doc.endnotes, "endnote"));
  if (doc.styles) files["word/styles.xml"] = strToU8(stylesXml(doc.styles));
  if (doc.numbering) files["word/numbering.xml"] = strToU8(numberingXml(doc.numbering));

  return zipSync(files);
}

/** Raw-zip builder for malformed-archive tests. */
export function buildZip(files: Record<string, string>): Uint8Array {
  const mapped: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) mapped[k] = strToU8(v);
  return zipSync(mapped);
}
