/**
 * Assembly of parsed OOXML parts into linear DocBlocks with numbering
 * resolution and stable anchors.
 */
import type { ContainerKind, DocBlock, DocRegion, ParseNote } from "../types";
import type { BlockNoteCode, LevelDef, OoxmlDocument, ParsedParagraph, ParsedTableInfo } from "./ooxml";

const FORMATS = new Set([
  "decimal",
  "decimalZero",
  "chineseCounting",
  "chineseCountingThousand",
  "chineseLegalSimplified",
  "lowerLetter",
  "upperLetter",
  "lowerRoman",
  "upperRoman",
  "none",
  "bullet",
]);

function toChinese(n: number, legal = false): string {
  const digits = legal ? "零壹贰叁肆伍陆柒捌玖" : "〇一二三四五六七八九";
  if (n <= 0) return String(n);
  if (n < 10) return digits[n]!;
  if (n < 20) return "十" + (n % 10 === 0 ? "" : digits[n % 10]!);
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return digits[tens]! + "十" + (ones === 0 ? "" : digits[ones]!);
  }
  return String(n);
}

function toRoman(n: number, lower: boolean): string {
  const table: Array<[number, string]> = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let out = "";
  let v = n;
  for (const [val, sym] of table) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return lower ? out : out.toUpperCase();
}

function toLetter(n: number, lower: boolean): string {
  let out = "";
  let v = n;
  while (v > 0) {
    const rem = (v - 1) % 26;
    out = String.fromCharCode(97 + rem) + out;
    v = Math.floor((v - 1) / 26);
  }
  return lower ? out : out.toUpperCase();
}

function renderCounter(n: number, fmt: string): string {
  switch (fmt) {
    case "decimalZero":
      return String(Math.max(0, n)).padStart(2, "0");
    case "chineseCounting":
    case "chineseCountingThousand":
      return toChinese(n);
    case "chineseLegalSimplified":
      return toChinese(n, true);
    case "lowerLetter":
      return toLetter(n, true);
    case "upperLetter":
      return toLetter(n, false);
    case "lowerRoman":
      return toRoman(n, true);
    case "upperRoman":
      return toRoman(n, false);
    case "none":
    case "bullet":
      return "";
    case "decimal":
    default:
      return String(n);
  }
}

/**
 * Resolve the rendered numbering text for a paragraph, tracking counters per
 * numId. Pragmatic Word semantics: incrementing the paragraph's level resets
 * all deeper levels.
 */
export class NumberingRenderer {
  private counters = new Map<number, Map<number, number>>(); // numId → ilvl → counter

  constructor(private doc: OoxmlDocument) {}

  render(numId: number | undefined, ilvl: number | undefined): string | undefined {
    if (numId === undefined || numId === 0) return undefined;
    const abstractId = this.doc.numbering.numToAbstract.get(numId);
    if (abstractId === undefined) return undefined;
    const levels = this.doc.numbering.abstractLevels.get(abstractId);
    if (!levels) return undefined;
    const level = ilvl ?? 0;
    const def: LevelDef | undefined = levels.get(level);
    if (!def || !FORMATS.has(def.numFmt)) return undefined;

    let counters = this.counters.get(numId);
    if (!counters) {
      counters = new Map();
      this.counters.set(numId, counters);
    }
    // Increment current level (or take start), reset deeper levels.
    const cur = counters.get(level) ?? def.start - 1;
    counters.set(level, cur + 1);
    for (const [l] of counters) {
      if (l > level) counters.set(l, 0);
    }

    if (!def.lvlText) {
      return renderCounter(counters.get(level)!, def.numFmt) || undefined;
    }
    return def.lvlText.replace(/%(\d)/g, (_m, d: string) => {
      const lvl = Number(d) - 1;
      const ldef = levels.get(lvl);
      const c = counters!.get(lvl) ?? ldef?.start ?? 1;
      return renderCounter(c, ldef?.numFmt ?? "decimal");
    });
  }
}

export interface AssembleOptions {
  /** styleId → heading level for known heading styles. */
  headingStyleIds?: Map<string, number>;
}

function notesFromSet(set: Set<BlockNoteCode>): ParseNote[] {
  return [...set].map((code) => ({ code }));
}

function isHeading(para: ParsedParagraph, styles: Map<string, string>): number | undefined {
  if (para.outlineLvl !== undefined && para.outlineLvl < 9) return para.outlineLvl + 1;
  if (para.styleId) {
    const name = styles.get(para.styleId) ?? "";
    const m = /^(?:heading|标题)\s*(\d)/i.exec(para.styleId) || /^(?:heading|标题)\s*(\d)/i.exec(name);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/** Assemble all DocBlocks from a parsed document, in stable linear order. */
export function assembleBlocks(doc: OoxmlDocument, _options: AssembleOptions = {}): DocBlock[] {
  const blocks: DocBlock[] = [];
  const numbering = new NumberingRenderer(doc);

  const pushParagraph = (
    para: ParsedParagraph,
    containerId: string,
    containerKind: ContainerKind,
    region: DocRegion
  ): void => {
    const headingLevel = isHeading(para, doc.styles);
    const numberingText = numbering.render(para.numId, para.ilvl);
    const notes = notesFromSet(para.notes);
    if (numberingText !== undefined) {
      notes.push({ code: "auto-numbered", detail: numberingText });
    }
    blocks.push({
      id: `${containerId}#${para.id}`,
      kind: headingLevel ? "heading" : containerKind === "table-cell" ? "table-cell" : containerKind === "footnote" ? "footnote" : containerKind === "endnote" ? "endnote" : "paragraph",
      text: para.text,
      containerId,
      containerKind,
      blockIndex: blocks.length,
      headingLevel,
      region,
      styleName: para.styleId ? doc.styles.get(para.styleId) : undefined,
      numberingText,
      notes,
      spans: para.spans,
    });
  };

  for (const item of doc.bodyOrder) {
    if (item.kind === "p") {
      pushParagraph(item.para, "body", "body", "body");
    } else {
      const t: ParsedTableInfo = item.table;
      t.rows.forEach((row, ri) => {
        row.forEach((cellParas, ci) => {
          for (const para of cellParas) {
            pushParagraph(para, `${t.id}:r${ri + 1}:c${ci + 1}`, "table-cell", "body");
          }
        });
      });
    }
  }

  for (const fn of doc.footnotes) {
    for (const para of fn.paragraphs) {
      pushParagraph(para, `fn:${fn.id}`, "footnote", "body");
    }
  }
  for (const en of doc.endnotes) {
    for (const para of en.paragraphs) {
      pushParagraph(para, `en:${en.id}`, "endnote", "body");
    }
  }

  return blocks;
}
