/**
 * Reference-section detection.
 *
 * Finds the start of the reference list by combining heading-text candidates
 * with structural evidence (numbered entries following the heading).
 */
import type { DocBlock } from "../types";

const HEADING_TEXT = /^(?:参\s*考\s*文\s*献|引\s*用\s*文\s*献|文\s*献|参考文献[:：]?|references?|bibliography|works\s*cited|literature\s*cited|r\s*e\s*f\s*e\s*r\s*e\s*n\s*c\s*e\s*s?)$/i;

/** A block that looks like "[5] 作者. 题名[J]…" or "5. 作者…" */
const ENTRY_PREFIX = /^\s*(?:[[［(（]\s*(\d{1,4})\s*[\]］)]|\d{1,4}\s*[.．、)]|[\u2460-\u2473\u3251-\u325F\u32B1-\u32BF])\s*\S/;

/** Stop markers that end the reference region. */
const SECTION_STOP = /^(?:附\s*录|附\s*件|致\s*谢|后\s*记|acknowledg|appendix|attach)/i;

export interface ReferenceSection {
  startIndex: number;
  endIndex: number; // inclusive
  title?: string;
  evidence: "heading+entries" | "heading" | "entries-run";
}

export function detectReferenceSection(blocks: DocBlock[]): ReferenceSection | undefined {
  // Candidate heading blocks
  const candidates: Array<{ index: number; title: string; score: number }> = [];
  for (const b of blocks) {
    const t = (b.numberingText ? b.text.replace(b.numberingText, "") : b.text).trim();
    if (!t || t.length > 20) continue;
    if (HEADING_TEXT.test(t)) {
      let score = 1;
      // Following numbered entries within the next 60 blocks
      let entries = 0;
      for (let i = b.blockIndex + 1; i < Math.min(blocks.length, b.blockIndex + 60); i++) {
        const nb = blocks[i]!;
        if (nb.kind === "heading" && i !== b.blockIndex) {
          const nt = (nb.numberingText ? nb.text.replace(nb.numberingText, "") : nb.text).trim();
          if (!HEADING_TEXT.test(nt)) break;
        }
        if (ENTRY_PREFIX.test(nb.text) || nb.numberingText) entries++;
        if (entries >= 3) break;
      }
      if (entries >= 3) score += 4;
      if (b.kind === "heading") score += 2;
      candidates.push({ index: b.blockIndex, title: t, score });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score || b.index - a.index);
    const best = candidates[0]!;
    if (best.score >= 5) {
      const end = regionEnd(blocks, best.index);
      return { startIndex: best.index, endIndex: end, title: best.title, evidence: "heading+entries" };
    }
    if (best.score >= 3) {
      const end = regionEnd(blocks, best.index);
      return { startIndex: best.index, endIndex: end, title: best.title, evidence: "heading" };
    }
  }

  // Fallback: a suffix run of ≥3 entry-like paragraphs (unheaded list).
  let runStart = -1;
  let runLen = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const looksEntry = ENTRY_PREFIX.test(b.text) || (b.numberingText !== undefined && b.text.trim().length > 15);
    const isBodyProse = b.kind === "paragraph" && b.text.length > 400;
    if (looksEntry && !isBodyProse) {
      if (runStart === -1) runStart = i;
      runLen++;
    } else {
      if (runLen >= 3 && runStart >= 0 && i > blocks.length * 0.3) {
        return { startIndex: runStart, endIndex: regionEnd(blocks, runStart - 1), evidence: "entries-run" };
      }
      runStart = -1;
      runLen = 0;
    }
  }
  // A suffix run of >=2 entries at the very end of the input is accepted in
  // paste mode, where users legitimately paste short lists.
  if (runLen >= 2 && runStart >= 0 && runStart + runLen === blocks.length) {
    return { startIndex: runStart, endIndex: regionEnd(blocks, runStart - 1), evidence: "entries-run" };
  }
  if (runLen >= 3 && runStart >= 0) {
    return { startIndex: runStart, endIndex: regionEnd(blocks, runStart - 1), evidence: "entries-run" };
  }
  return undefined;
}

/** Blocks from `afterIndex+1` until a stop marker (or end). */
function regionEnd(blocks: DocBlock[], afterIndex: number): number {
  let end = blocks.length - 1;
  for (let i = afterIndex + 1; i < blocks.length; i++) {
    const b = blocks[i]!;
    const t = (b.numberingText ? b.text.replace(b.numberingText, "") : b.text).trim();
    if (b.kind === "heading" && t.length > 0 && !HEADING_TEXT.test(t)) {
      end = i - 1;
      break;
    }
    if (SECTION_STOP.test(t) && t.length < 30) {
      end = i - 1;
      break;
    }
  }
  return end;
}

/** Mutates the given blocks: assigns region="references" to the section. */
export function applyReferenceRegion(blocks: DocBlock[], section: ReferenceSection): void {
  for (let i = section.startIndex; i <= section.endIndex && i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.kind === "heading" && i === section.startIndex) continue; // keep title as heading
    // Only body paragraphs form the reference list; table cells / notes keep
    // their own region so citations inside them remain analyzable.
    if (b.containerKind !== "body") continue;
    b.region = "references";
  }
}
