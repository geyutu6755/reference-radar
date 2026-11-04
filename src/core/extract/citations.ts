/**
 * Citation extraction from parsed blocks.
 *
 * Recognizes bracketed numeric markers — [1], [1,2], [1, 2, 3], [1-3],
 * [1–3], [1,3-5], [1，3—5] and full-width ［…］ variants — expands ranges
 * into logical numbers, and applies structural disambiguation so that math
 * vectors, data-table numbers, chapter numbers and reference-list labels are
 * not misread as citations.
 */
import type { Citation, CitationSegment, Confidence, DocBlock } from "../types";

/** Bracket content: integers joined by , ， 、 separators and - – — ～ ~ ranges. */
const CITATION_RE = /[[［]\s*(\d{1,4}(?:\s*[,，、]\s*\d{1,4}|\s*[-–—～~]\s*\d{1,4})*)\s*[\]］]/g;

const MATH_BEFORE = /[=∈×÷≈≤≥±⊕∑∫|^~]\s*$/;
const MATH_AFTER = /^\s*[=∈×÷≈≤≥±⊕∑∫]/;

/** Words that strongly indicate a citation context. */
const CITATION_VERB = /(?:文献|参见|参阅|见|如.{0,6}所示|所述|研究|报道|表明|指出|参考|依据|来源|摘自|et al)\s*$/;

/**
 * V1.1.2 plausibility bounds (P0: unbounded ranges).
 *
 * Real GB/T 7714 reference lists stay far below these limits; anything beyond
 * them is a year range, a data label or a hostile input, and must not be
 * expanded into citation numbers (which would flood the rule engine, the
 * relation graph and the report).
 */
/** A bracket number above this is a year or data value, not a reference index. */
export const MAX_PLAUSIBLE_REF_NUMBER = 999;
/** A single range longer than this (e.g. [1-9999]) is not expanded. */
export const MAX_RANGE_SPAN = 50;
/** Total expanded numbers per document, to stop cumulative abuse. */
export const MAX_TOTAL_EXPANSION = 5000;

export function parseCitationContent(content: string, contentStart: number): {
  segments: CitationSegment[];
  numbers: number[];
  invalid: boolean;
} {
  const segments: CitationSegment[] = [];
  const numbers: number[] = [];
  let invalid = false;
  const parts = content.split(/\s*[,，、]\s*/);
  // Offsets within the full paragraph text: content starts at contentStart.
  let cursor = contentStart;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      invalid = true;
      cursor += part.length + 1;
      continue;
    }
    const rangeMatch = /^(\d{1,4})\s*([-–—～~])\s*(\d{1,4})$/.exec(trimmed);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[3]);
      segments.push({ kind: "range", start: a, end: b, rawStart: cursor, rawEnd: cursor + part.length });
      if (b >= a) {
        for (let n = a; n <= b; n++) numbers.push(n);
      } else {
        invalid = true; // inverted range — kept for the rule engine to flag
      }
    } else if (/^\d{1,4}$/.test(trimmed)) {
      const n = Number(trimmed);
      segments.push({ kind: "single", start: n, end: n, rawStart: cursor, rawEnd: cursor + part.length });
      numbers.push(n);
    } else {
      invalid = true;
    }
    cursor += part.length + 1; // +1 for the separator (approximate for offsets)
  }
  return { segments, numbers, invalid };
}

export interface ExtractResult {
  citations: Citation[];
  /** blockIndex values of paragraphs that look like reference entries
   *  (bracketed number at start + entry-like text) — fallback candidates for
   *  reference-list detection when no heading exists. */
  entryLike: number[];
}

export function extractCitations(blocks: DocBlock[]): ExtractResult {
  const citations: Citation[] = [];
  const entryLike: number[] = [];
  const firstSeen = new Map<number, number>();
  let expandedTotal = 0; // cumulative expansion budget (V1.1.2 P0)

  for (const block of blocks) {
    // Headings are not citation sites (chapter numbers, caption labels).
    if (block.kind === "heading") continue;
    // The reference list itself: its [n] labels are not citations.
    if (block.region === "references") continue;

    const text = block.text;
    if (!text || (text.indexOf("[") === -1 && text.indexOf("［") === -1)) continue;

    CITATION_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CITATION_RE.exec(text)) !== null) {
      const raw = m[0];
      const content = m[1] ?? "";
      const charStart = m.index;
      const charEnd = m.index + raw.length;
      const parsed = parseCitationContent(content, charStart + raw.indexOf(content));
      if (parsed.numbers.length === 0 && parsed.segments.length === 0) continue;

      const signals: string[] = [];
      let confidence: Confidence = "medium";
      let needsReview = false;

      const before = text.slice(Math.max(0, charStart - 24), charStart);
      const after = text.slice(charEnd, charEnd + 24);

      // ---- structural signals ----
      const spans = (block.spans ?? []).filter((s) => s.start <= charStart && s.end >= charEnd);
      const isSuperscript =
        spans.length > 0 && spans.every((s) => s.flags.superscript && !s.flags.deleted && !s.flags.hidden);
      const inTable = block.containerKind === "table-cell";
      const inNotes = block.containerKind === "footnote" || block.containerKind === "endnote";

      const preceding = text.slice(0, charStart).replace(/\s+$/, "");
      const prevChar = preceding.length > 0 ? preceding[preceding.length - 1]! : "";
      const embeddedInProse = prevChar !== "" && /[\u4e00-\u9fffA-Za-z）)”"’]/.test(prevChar);
      const atParaStart = preceding.length === 0;

      // "[1] 张三. 题名[J]. 期刊, 2024…" at paragraph start = likely entry.
      const entryish =
        atParaStart &&
        text.length > 40 &&
        (/[[［][A-Z]{1,2}(\/[A-Z]{1,2})*[\]］]/.test(text) || /[.。]\s*\d{4}/.test(text));

      if (entryish) {
        signals.push("paragraph-start-entry-like");
        entryLike.push(block.blockIndex);
        continue; // not a citation — handled by reference parsing
      }
      const promote = (): void => {
        if (confidence !== "low") confidence = "high";
      };
      if (isSuperscript) {
        signals.push("superscript");
        promote();
      }
      if (embeddedInProse) {
        signals.push("embedded-in-prose");
        promote();
      }
      if (CITATION_VERB.test(before)) {
        signals.push("citation-verb-before");
        promote();
      }
      if (atParaStart) signals.push("paragraph-start");
      if (inTable) {
        signals.push("table-cell");
        // Lone/short cells with brackets are usually data labels or vectors.
        if (text.replace(/\s/g, "").length <= raw.length + 4) {
          signals.push("cell-mostly-bracket");
          needsReview = true;
          confidence = "low";
        }
      }
      if (inNotes) signals.push("notes-area");
      if (MATH_BEFORE.test(before) || MATH_AFTER.test(after)) {
        signals.push("math-adjacent");
        needsReview = true;
        confidence = "low";
      }
      if (spans.some((s) => s.flags.formula)) {
        signals.push("inside-formula");
        needsReview = true;
      }
      if (parsed.invalid) {
        signals.push("content-parse-issue");
        needsReview = true;
      }
      if (parsed.numbers.some((n) => n === 0)) {
        // GB/T 7714 sequential numbering starts at 1 — a 0 suggests this is
        // not a citation (e.g. an interval or data label).
        signals.push("zero-number");
        needsReview = true;
      }
      if (block.notes.some((n) => n.code === "hidden-text")) signals.push("block-has-hidden-text");
      if (block.notes.some((n) => n.code === "revised-deletion")) signals.push("block-has-revised-content");

      // ---- V1.1.2 P0: plausibility bounds before anything downstream ----
      let numbers = parsed.numbers;
      // (a) Numbers above the plausibility bound are years or data values.
      const implausible = numbers.filter((n) => n > MAX_PLAUSIBLE_REF_NUMBER);
      if (implausible.length > 0) {
        signals.push(`implausible-number>${MAX_PLAUSIBLE_REF_NUMBER}:${implausible.slice(0, 3).join(",")}`);
        needsReview = true;
        numbers = numbers.filter((n) => n <= MAX_PLAUSIBLE_REF_NUMBER);
      }
      // (b) Ranges longer than the span cap are not expanded (e.g. [1-9999]).
      const overlong = parsed.segments.filter(
        (seg) => seg.kind === "range" && seg.end - seg.start + 1 > MAX_RANGE_SPAN
      );
      if (overlong.length > 0) {
        signals.push(`range-too-long:${overlong.map((s) => `${s.start}-${s.end}`).join(",")}`);
        needsReview = true;
        const dropped = new Set<number>();
        for (const seg of overlong) {
          for (let n = seg.start; n <= seg.end; n++) dropped.add(n);
        }
        numbers = numbers.filter((n) => !dropped.has(n));
      }
      // (c) Cumulative expansion budget: once exhausted, further ranges stay
      // unexpanded and the marker is parked in the review queue.
      const budgetLeft = Math.max(0, MAX_TOTAL_EXPANSION - expandedTotal);
      if (numbers.length > budgetLeft) {
        signals.push(`expansion-budget-exhausted:${numbers.length}>${budgetLeft}`);
        needsReview = true;
        numbers = [];
      }
      expandedTotal += numbers.length;

      const order = citations.length;
      const firstOccurrence: number[] = [];
      for (const n of parsed.numbers) {
        if (!firstSeen.has(n)) {
          firstSeen.set(n, order);
          firstOccurrence.push(n);
        }
      }
      citations.push({
        id: `cit-${order}`,
        raw,
        numbers,
        segments: parsed.segments,
        anchor: {
          containerId: block.containerId,
          containerKind: block.containerKind,
          paragraphId: block.id,
          blockIndex: block.blockIndex,
          charStart,
          charEnd,
          text: raw,
        },
        contextBefore: before.slice(-24),
        contextAfter: after,
        order,
        isFirstOccurrenceOf: firstOccurrence,
        detection: { confidence, signals, needsReview },
      });
    }
  }

  return { citations, entryLike };
}
