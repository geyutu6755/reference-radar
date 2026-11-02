/**
 * Reference entry parsing: number labels, multi-paragraph entries, fields.
 */
import type { Confidence, DocBlock, ParseNote, ReferenceEntry } from "../types";
import { extractFields } from "./fields";

/** Leading number label forms: [1] 1. 1．1、 (1) （1） ① */
const LEADING_LABEL =
  /^\s*(?:[[［]\s*(\d{1,4})\s*[\]］]|\[\s*(\d{1,4})\s*\]|\((\d{1,4})\)|（(\d{1,4})）|(\d{1,4})\s*[.．、)]|([\u2460-\u2473]))\s*/;

function circledToNumber(ch: string): number | undefined {
  const code = ch.codePointAt(0)!;
  if (code >= 0x2460 && code <= 0x2473) return code - 0x2460 + 1;
  return undefined;
}

/** A genuine entry may wrap a couple of lines; more than that is a segmentation failure. */
const MAX_CONTINUATIONS_PER_ENTRY = 2;

export interface ParsedReferenceList {
  entries: ReferenceEntry[];
  /** Blocks consumed as continuation of multi-paragraph entries. */
  continuationBlocks: number[];
}

export function parseReferenceEntries(
  blocks: DocBlock[],
  startIndex: number,
  endIndex: number
): ParsedReferenceList {
  const entries: ReferenceEntry[] = [];
  const continuationBlocks: number[] = [];
  let pendingMerges = 0;

  for (let i = startIndex; i <= endIndex && i < blocks.length; i++) {
    const block = blocks[i]!;
    if (block.kind === "heading") continue;
    const text = block.text.trim();
    if (!text) continue;

    const labelMatch = LEADING_LABEL.exec(text);
    let index: number | undefined;
    let displayNumber = "";
    let numberingKind: ReferenceEntry["numberingKind"] = "none";
    let raw = text;
    const notes: ParseNote[] = [];

    if (labelMatch) {
      const circled = labelMatch[6];
      const num = circled
        ? circledToNumber(circled)
        : Number(labelMatch[1] ?? labelMatch[2] ?? labelMatch[3] ?? labelMatch[4] ?? labelMatch[5]);
      if (num !== undefined && Number.isFinite(num)) {
        index = num;
        displayNumber = labelMatch[0].trim();
        numberingKind = "manual";
        raw = text.slice(labelMatch[0].length).trim();
      }
    } else if (block.numberingText !== undefined && block.numberingText !== "") {
      const numText = block.numberingText.replace(/[\s.．)、）\]［[（(]/g, "");
      const num = Number(/^\d+$/.test(numText) ? numText : NaN);
      if (Number.isFinite(num)) {
        index = num;
        displayNumber = block.numberingText;
        numberingKind = "auto";
        raw = text;
        notes.push({ code: "auto-numbered", detail: block.numberingText });
      }
    }

    if (index === undefined) {
      // No label → continuation of the previous entry (multi-paragraph entry).
      const prev = entries[entries.length - 1];
      if (prev) {
        if (pendingMerges >= MAX_CONTINUATIONS_PER_ENTRY) {
          // A whole list arriving as unlabeled blocks (lost auto-numbering) must
          // not be absorbed one entry at a time: stop, mark, let the pipeline
          // disclose that numbering conclusions are unreliable (V1.1.1).
          if (!prev.notes.some((n) => n.code === "entry-merge-suspect")) {
            prev.notes.push({ code: "entry-merge-suspect" });
          }
          continue;
        }
        prev.raw += " " + text;
        prev.notes.push({ code: "multi-paragraph-entry" });
        continuationBlocks.push(block.blockIndex);
        pendingMerges++;
        continue;
      }
      // Entry-like prose before any numbered entry — skip but note.
      continue;
    }

    const { fields, confidence } = extractFields(raw);
    pendingMerges = 0;
    entries.push({
      id: `ref-${entries.length}`,
      index,
      displayNumber,
      numberingKind,
      raw,
      fields,
      fieldsConfidence: confidence satisfies Confidence,
      anchor: {
        containerId: block.containerId,
        containerKind: block.containerKind,
        paragraphId: block.id,
        blockIndex: block.blockIndex,
        charStart: 0,
        charEnd: block.text.length,
        text: block.text,
      },
      notes,
    });
  }

  return { entries, continuationBlocks };
}
