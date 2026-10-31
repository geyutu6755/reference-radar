/**
 * OOXML structural parsing.
 *
 * Uses fast-xml-parser in preserveOrder mode throughout, so text runs,
 * tabs, breaks and fields keep their true source order (required for
 * accurate character-offset anchors).
 *
 * Text merging rules:
 * - w:t text is concatenated; w:tab renders as \t; w:br / w:cr render as \n.
 * - Tracked-deleted content is excluded from visible text but noted.
 * - Hidden (w:vanish) text is excluded from visible text but noted — we never
 *   silently analyze content the reader would not see.
 * - Fields: instruction text is captured for manager detection
 *   (Zotero/Mendeley/EndNote); displayed result runs are used as text.
 * - Math (m:oMath) is replaced by a single "□" placeholder and noted.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";

/* ------------------------------------------------------------------ */
/* preserveOrder tree helpers                                          */
/* ------------------------------------------------------------------ */

export type ONode = Record<string, unknown>;
/** preserveOrder entry: { TagName: [children], ":@": attrs } */
export type OEntry = Record<string, unknown>;

const ORDER_PARSER = new XMLParser({
  removeNSPrefix: true,
  processEntities: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  preserveOrder: true,
  ignorePiTags: true,
});

/** Parse XML into an ordered tree; returns the root entry. Throws on invalid XML. */
export function parseXmlOrdered(xml: string): OEntry | undefined {
  const check = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  if (check !== true) {
    const where = check.err ? ` (line ${check.err.line}, col ${check.err.col})` : "";
    throw new Error(`XML 结构无效${where} / Invalid XML structure${where}`);
  }
  const tree = ORDER_PARSER.parse(xml) as OEntry[];
  return tree[0];
}

export function entryName(e: OEntry): string | undefined {
  for (const k of Object.keys(e)) {
    if (k === ":@") continue;
    if (k === "#text") continue;
    return k;
  }
  return undefined;
}

export function entryChildren(e: OEntry): OEntry[] {
  const name = entryName(e);
  if (!name) return [];
  const v = e[name];
  return Array.isArray(v) ? (v as OEntry[]) : [];
}

export function entryAttrs(e: OEntry): Record<string, string> {
  return (e[":@"] as Record<string, string> | undefined) ?? {};
}

export function entryAttr(e: OEntry | undefined, name: string): string | undefined {
  if (!e) return undefined;
  const attrs = entryAttrs(e);
  const v = attrs[`@_${name}`] ?? attrs[name];
  return v === undefined ? undefined : String(v);
}

export function entryAttrNum(e: OEntry | undefined, name: string): number | undefined {
  const s = entryAttr(e, name);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** First child with the given tag name. */
export function firstChild(e: OEntry | undefined, name: string): OEntry | undefined {
  if (!e) return undefined;
  return entryChildren(e).find((c) => entryName(c) === name);
}

/** All children with the given tag name. */
export function allChildren(e: OEntry | undefined, name: string): OEntry[] {
  if (!e) return [];
  return entryChildren(e).filter((c) => entryName(c) === name);
}

/** Text content directly inside this entry (#text pieces concatenated). */
export function ownText(e: OEntry): string {
  const name = entryName(e);
  if (!name) return "";
  const v = e[name];
  const arr = Array.isArray(v) ? v : [v];
  let out = "";
  for (const piece of arr) {
    if (piece && typeof piece === "object" && "#text" in (piece as OEntry)) {
      const t = (piece as OEntry)["#text"];
      if (typeof t === "string") out += t;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Parsed structures                                                   */
/* ------------------------------------------------------------------ */

export interface RunSpan {
  start: number;
  end: number;
  flags: SpanFlags;
}

export interface SpanFlags {
  hidden?: boolean;
  deleted?: boolean;
  fieldResult?: boolean;
  fieldInstr?: boolean;
  hyperlink?: boolean;
  formula?: boolean;
  inserted?: boolean;
  superscript?: boolean;
}

export type BlockNoteCode =
  | "revised-insertion"
  | "revised-deletion"
  | "hidden-text"
  | "field-code"
  | "field-result-unresolved"
  | "zotero-field"
  | "mendeley-field"
  | "endnote-field"
  | "auto-numbered"
  | "image-formula"
  | "hyperlink"
  | "unsupported-structure";

export interface ParsedParagraph {
  id: string;
  text: string;
  spans: RunSpan[];
  styleId?: string;
  outlineLvl?: number;
  numId?: number;
  ilvl?: number;
  notes: Set<BlockNoteCode>;
  /** Relation ids of hyperlinks in this paragraph (for external link notes). */
  hyperlinkRels: string[];
}

export interface ParsedTableInfo {
  id: string;
  rows: ParsedParagraph[][][]; // rows → cells → paragraphs
}

export interface OoxmlDocument {
  bodyOrder: Array<{ kind: "p"; para: ParsedParagraph } | { kind: "table"; table: ParsedTableInfo }>;
  footnotes: Array<{ id: number; paragraphs: ParsedParagraph[] }>;
  endnotes: Array<{ id: number; paragraphs: ParsedParagraph[] }>;
  /** styleId → style name (w:name val) */
  styles: Map<string, string>;
  numbering: NumberingMap;
  /** relId → { type, target, external } from document.xml.rels */
  rels: Map<string, { type: string; target: string; external: boolean }>;
  hasDocumentPart: boolean;
  warnings: string[];
}

export interface NumberingMap {
  numToAbstract: Map<number, number>;
  /** abstractNumId → ilvl → definition */
  abstractLevels: Map<number, Map<number, LevelDef>>;
}

export interface LevelDef {
  numFmt: string;
  lvlText: string;
  start: number;
}

/* ------------------------------------------------------------------ */
/* Part parsing                                                        */
/* ------------------------------------------------------------------ */

export function parseOoxml(parts: {
  documentXml?: string;
  footnotesXml?: string;
  endnotesXml?: string;
  stylesXml?: string;
  numberingXml?: string;
  documentRelsXml?: string;
}): OoxmlDocument {
  const warnings: string[] = [];
  const doc: OoxmlDocument = {
    bodyOrder: [],
    footnotes: [],
    endnotes: [],
    styles: new Map(),
    numbering: { numToAbstract: new Map(), abstractLevels: new Map() },
    rels: new Map(),
    hasDocumentPart: false,
    warnings,
  };

  if (parts.stylesXml) {
    try {
      const root = parseXmlOrdered(parts.stylesXml);
      for (const st of allChildren(root, "style")) {
        const id = entryAttr(st, "styleId");
        const name = entryAttr(firstChild(st, "name"), "val");
        if (id && name) doc.styles.set(id, name);
      }
    } catch (e) {
      warnings.push(`styles.xml 解析失败 / styles.xml parse failed: ${(e as Error).message}`);
    }
  }

  if (parts.numberingXml) {
    try {
      const root = parseXmlOrdered(parts.numberingXml);
      for (const abs of allChildren(root, "abstractNum")) {
        const absId = entryAttrNum(abs, "abstractNumId");
        if (absId === undefined) continue;
        const levels = new Map<number, LevelDef>();
        for (const lvl of allChildren(abs, "lvl")) {
          const ilvl = entryAttrNum(lvl, "ilvl");
          if (ilvl === undefined) continue;
          levels.set(ilvl, {
            numFmt: entryAttr(firstChild(lvl, "numFmt"), "val") ?? "decimal",
            lvlText: entryAttr(firstChild(lvl, "lvlText"), "val") ?? "",
            start: entryAttrNum(firstChild(lvl, "start"), "val") ?? 1,
          });
        }
        doc.numbering.abstractLevels.set(absId, levels);
      }
      for (const num of allChildren(root, "num")) {
        const numId = entryAttrNum(num, "numId");
        const absId = entryAttrNum(firstChild(num, "abstractNumId"), "val");
        if (numId !== undefined && absId !== undefined) doc.numbering.numToAbstract.set(numId, absId);
      }
    } catch (e) {
      warnings.push(`numbering.xml 解析失败，自动编号将无法显示文本 / numbering.xml parse failed: ${(e as Error).message}`);
    }
  }

  if (parts.documentRelsXml) {
    try {
      const root = parseXmlOrdered(parts.documentRelsXml);
      for (const rel of allChildren(root, "Relationship")) {
        const id = entryAttr(rel, "Id");
        const type = entryAttr(rel, "Type") ?? "";
        const target = entryAttr(rel, "Target") ?? "";
        const external = entryAttr(rel, "TargetMode") === "External";
        if (id) doc.rels.set(id, { type, target, external });
      }
    } catch {
      // non-fatal
    }
  }

  if (parts.documentXml) {
    try {
      const root = parseXmlOrdered(parts.documentXml);
      const docEl = firstChild(root, "document") ?? root;
      const body = firstChild(docEl, "body");
      if (!body) {
        doc.warnings.push("document.xml 缺少 body / document.xml has no body");
      } else {
        doc.hasDocumentPart = true;
        let pi = 0;
        let ti = 0;
        for (const item of entryChildren(body)) {
          const name = entryName(item);
          if (name === "p") {
            doc.bodyOrder.push({ kind: "p", para: walkParagraph(item, `body:p${pi++}`) });
          } else if (name === "tbl") {
            doc.bodyOrder.push({ kind: "table", table: walkTable(item, `tbl${ti++}`) });
          } else if (name === "sdt" || name === "customXml") {
            walkSdt(item, doc, pi, ti);
          }
        }
      }
    } catch (e) {
      throw new Error(`document.xml 解析失败 / Failed to parse document.xml: ${(e as Error).message}`);
    }
  }

  for (const [xml, kind] of [
    [parts.footnotesXml, "footnote"],
    [parts.endnotesXml, "endnote"],
  ] as const) {
    if (!xml) continue;
    try {
      const root = parseXmlOrdered(xml);
      const wrapperName = kind === "footnote" ? "footnotes" : "endnotes";
      const wrapper = firstChild(root, wrapperName) ?? root;
      for (const item of allChildren(wrapper, kind)) {
        const id = entryAttrNum(item, "id");
        if (id === undefined || id <= 0) continue;
        const paragraphs: ParsedParagraph[] = [];
        let n = 0;
        for (const child of entryChildren(item)) {
          if (entryName(child) === "p") {
            paragraphs.push(walkParagraph(child, `${kind}:${id}:p${n++}`));
          }
        }
        if (kind === "footnote") doc.footnotes.push({ id, paragraphs });
        else doc.endnotes.push({ id, paragraphs });
      }
    } catch (e) {
      doc.warnings.push(
        `${kind === "footnote" ? "脚注" : "尾注"}部分解析失败，该区域未分析 / ${kind}s part failed to parse and was not analyzed: ${(e as Error).message}`
      );
    }
  }

  return doc;
}

function walkSdt(sdt: OEntry, doc: OoxmlDocument, pi: number, ti: number): void {
  const content = firstChild(sdt, "sdtContent") ?? sdt;
  for (const item of entryChildren(content)) {
    const name = entryName(item);
    if (name === "p") {
      doc.bodyOrder.push({ kind: "p", para: walkParagraph(item, `body:p${pi++}`) });
    } else if (name === "tbl") {
      doc.bodyOrder.push({ kind: "table", table: walkTable(item, `tbl${ti++}`) });
    } else if (name === "sdt") {
      walkSdt(item, doc, pi, ti);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Paragraph walk                                                      */
/* ------------------------------------------------------------------ */

const FORMULA_PLACEHOLDER = "□";

export function walkParagraph(p: OEntry, id: string): ParsedParagraph {
  const notes = new Set<BlockNoteCode>();
  const spans: RunSpan[] = [];
  const hyperlinkRels: string[] = [];
  let text = "";

  const pPr = firstChild(p, "pPr");
  const styleId = entryAttr(firstChild(pPr, "pStyle"), "val");
  const outlineLvl = entryAttrNum(firstChild(pPr, "outlineLvl"), "val");
  const numPr = firstChild(pPr, "numPr");
  const numId = numPr ? entryAttrNum(firstChild(numPr, "numId"), "val") : undefined;
  const ilvl = numPr ? (entryAttrNum(firstChild(numPr, "ilvl"), "val") ?? 0) : undefined;

  interface FieldState {
    instr: string;
    inResult: boolean;
    unresolved: boolean;
  }
  const fieldStack: FieldState[] = [];

  const flagsEqual = (a: SpanFlags, b: SpanFlags): boolean => {
    const keys: Array<keyof SpanFlags> = [
      "hidden",
      "deleted",
      "fieldResult",
      "fieldInstr",
      "hyperlink",
      "formula",
      "inserted",
    ];
    return keys.every((k) => !!a[k] === !!b[k]);
  };

  const pushText = (s: string, flags: SpanFlags): void => {
    if (!s) return;
    const start = text.length;
    text += s;
    const prev = spans[spans.length - 1];
    if (prev && prev.end === start && flagsEqual(prev.flags, flags)) {
      prev.end = text.length;
    } else {
      spans.push({ start, end: text.length, flags });
    }
  };

  /** Whether vanish is on given rPr children. */
  const isHidden = (r: OEntry): boolean => {
    const rPr = firstChild(r, "rPr");
    const vanish = rPr ? firstChild(rPr, "vanish") : undefined;
    if (!vanish) return false;
    const val = entryAttr(vanish, "val");
    return val !== "0" && val !== "false";
  };

  const isSuperscript = (r: OEntry): boolean => {
    const rPr = firstChild(r, "rPr");
    const va = rPr ? firstChild(rPr, "vertAlign") : undefined;
    return va ? entryAttr(va, "val") === "superscript" : false;
  };

  const classifyField = (instr: string): void => {
    const up = instr.toUpperCase();
    if (up.includes("ZOTERO")) notes.add("zotero-field");
    else if (up.includes("CSL_CITATION") || up.includes("MENDELEY")) notes.add("mendeley-field");
    else if (up.includes("EN.") || up.includes("ENDNOTE")) notes.add("endnote-field");
    if (instr.trim().length > 0) notes.add("field-code");
  };

  /** Walk the children of a run (w:r) or revision wrapper. */
  const walkRun = (r: OEntry, base: SpanFlags): void => {
    const hidden = isHidden(r);
    const superscript = isSuperscript(r);
    // Field state contributes to span flags for display purposes.
    const top = fieldStack[fieldStack.length - 1];
    const effBase: SpanFlags =
      top && top.inResult ? { ...base, fieldResult: true } : top ? { ...base, fieldInstr: true } : base;
    for (const child of entryChildren(r)) {
      const name = entryName(child);
      if (!name || name === "rPr") continue;
      if (name === "t") {
        const t = ownText(child);
        if (hidden) {
          // Hidden text is not part of the visible document: excluded from
          // merged text, recorded as a note so the scope is transparent.
          notes.add("hidden-text");
          void superscript;
        } else {
          pushText(t, superscript ? { ...effBase, superscript: true } : effBase);
        }
      } else if (name === "delText") {
        notes.add("revised-deletion");
        // tracked-deleted content is not visible text
      } else if (name === "tab") {
        if (!hidden) pushText("\t", base);
      } else if (name === "br" || name === "cr") {
        if (!hidden) pushText("\n", base);
      } else if (name === "instrText") {
        const instr = ownText(child);
        const top = fieldStack[fieldStack.length - 1];
        if (top) top.instr += instr;
        // Field instructions are not displayed content — not part of text.
      } else if (name === "fldChar") {
        const type = entryAttr(child, "fldCharType");
        if (type === "begin") {
          fieldStack.push({ instr: "", inResult: false, unresolved: true });
        } else if (type === "separate") {
          const top = fieldStack[fieldStack.length - 1];
          if (top) {
            top.inResult = true;
            top.unresolved = false;
          }
        } else if (type === "end") {
          const top = fieldStack.pop();
          if (top) {
            classifyField(top.instr);
            if (top.unresolved) notes.add("field-result-unresolved");
          }
        }
      } else if (name === "noBreakHyphen") {
        pushText("-", effBase);
      } else if (name === "sym") {
        // Symbol run: content not reliably extractable; use nothing but note.
        notes.add("unsupported-structure");
      } else if (name === "oMath" || name === "oMathPara") {
        notes.add("image-formula");
        pushText(FORMULA_PLACEHOLDER, { ...effBase, formula: true });
      } else if (name === "drawing" || name === "object" || name === "pict") {
        notes.add("unsupported-structure");
      }
    }
  };

  const walkInline = (node: OEntry, base: SpanFlags): void => {
    for (const child of entryChildren(node)) {
      const name = entryName(child);
      if (!name) continue;
      if (name === "r") {
        walkRun(child, base);
      } else if (name === "hyperlink") {
        const rid = entryAttr(child, "id");
        if (rid) hyperlinkRels.push(rid);
        notes.add("hyperlink");
        walkInline(child, { ...base, hyperlink: true });
      } else if (name === "ins") {
        notes.add("revised-insertion");
        walkInline(child, { ...base, inserted: true });
      } else if (name === "del") {
        notes.add("revised-deletion");
        walkInline(child, { ...base, deleted: true });
      } else if (name === "oMath" || name === "oMathPara") {
        notes.add("image-formula");
        pushText(FORMULA_PLACEHOLDER, { ...base, formula: true });
      } else if (name === "fldSimple") {
        const instr = entryAttr(child, "instr") ?? "";
        classifyField(instr);
        const hasResult = entryChildren(child).some((c) => entryName(c) === "r");
        walkInline(child, { ...base, fieldResult: true });
        if (!hasResult) notes.add("field-result-unresolved");
      } else if (name === "smartTag" || name === "sdt" || name === "customXml") {
        walkInline(child, base);
      } else if (name === "oMathParaPr" || name === "oMathPr") {
        continue;
      } else if (name === "bookmarkStart" || name === "bookmarkEnd" || name === "proofErr") {
        continue;
      }
    }
  };

  walkInline(p, {});
  // Unbalanced field: any remaining open field counts as unresolved
  if (fieldStack.some((f) => f.unresolved)) notes.add("field-result-unresolved");

  return { id, text, spans, styleId, outlineLvl, numId, ilvl, notes, hyperlinkRels };
}

export function walkTable(tbl: OEntry, id: string): ParsedTableInfo {
  const rows: ParsedParagraph[][][] = [];
  allChildren(tbl, "tr").forEach((tr, r) => {
    const cells: ParsedParagraph[][] = [];
    allChildren(tr, "tc").forEach((tc, c) => {
      const paras: ParsedParagraph[] = [];
      let pi = 0;
      for (const item of entryChildren(tc)) {
        const name = entryName(item);
        if (name === "p") {
          paras.push(walkParagraph(item, `${id}:r${r + 1}:c${c + 1}:p${pi++}`));
        } else if (name === "tbl") {
          const nested = walkTable(item, `${id}n${r}_${c}`);
          for (const row of nested.rows) for (const cell of row) paras.push(...cell);
        }
      }
      cells.push(paras);
    });
    rows.push(cells);
  });
  return { id, rows };
}
