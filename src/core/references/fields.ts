/**
 * Bibliographic field extraction from a raw entry string (GB/T 7714 style).
 * Best-effort with recorded confidence; the raw string is always preserved.
 */
import type { Confidence, ReferenceFields } from "../types";

export interface FieldsResult {
  fields: ReferenceFields;
  confidence: Confidence;
}

const TYPE_ID = /[[［]\s*([A-Z]{1,2}(?:\s*\/\s*[A-Z]{1,2})*)\s*[\]］]/;
const DOI_EXPLICIT = /(?:doi|DOI|Doi)\s*[:：]?\s*(10\.\d{4,9}\/[^\s,，;；"”\]]+)/;
const DOI_BARE = /(10\.\d{4,9}\/[^\s,，;；"”\]]+)(?=[.\s]|$)/;
const URL = /((?:https?:\/\/|www\.)[^\s,，;；"”\]]+)/i;
const CITED_DATE = /[[［]\s*(\d{4}-\d{2}-\d{2})\s*[\]］]/;
const YEAR = /(?:[^0-9]|^)(\d{4})(?:[^0-9]|$)/;
const PAGES_TAIL = /[:：]\s*(\d{1,5})\s*[-–—]\s*(\d{1,5})\s*\.?\s*$/;
const PAGES_SINGLE_TAIL = /[:：]\s*(\d{1,5})\s*\.?\s*$/;
const VOL_ISSUE = /,\s*(\d{1,4})\s*\(([^()]{1,20})\)\s*[:：]/;

export function extractFields(raw: string): FieldsResult {
  const fields: ReferenceFields = {};
  let hits = 0;
  let attempts = 0;

  const typeMatch = TYPE_ID.exec(raw);
  if (typeMatch) {
    attempts++;
    const full = typeMatch[1]!.replace(/\s+/g, "");
    fields.typeIdentifier = `[${full}]`;
    const parts = full.split("/");
    fields.typeCode = parts[0];
    fields.carrierCode = parts.length > 1 ? parts[parts.length - 1] : undefined;
    hits++;
  }

  const cited = CITED_DATE.exec(raw);
  if (cited) {
    attempts++;
    fields.citedDate = cited[1];
    hits++;
  }

  const doiExplicit = DOI_EXPLICIT.exec(raw);
  const doi = doiExplicit ? doiExplicit[1] : DOI_BARE.test(raw) ? DOI_BARE.exec(raw)![1] : undefined;
  if (doi) {
    attempts++;
    fields.doi = doi.replace(/[.。]$/, "");
    hits++;
  }

  const url = URL.exec(raw);
  if (url) {
    attempts++;
    fields.url = url[1]!.replace(/[.。]$/, "");
    hits++;
  }

  const volIssue = VOL_ISSUE.exec(raw);
  if (volIssue) {
    attempts++;
    fields.volume = volIssue[1];
    fields.issue = volIssue[2]!.trim();
  }

  const pagesTail = PAGES_TAIL.exec(raw) ?? PAGES_SINGLE_TAIL.exec(raw);
  if (pagesTail) {
    attempts++;
    const second = PAGES_TAIL.exec(raw);
    fields.pages = second ? `${second[1]}-${second[2]}` : PAGES_SINGLE_TAIL.exec(raw)![1]!;
    hits++;
  }

  const year = YEAR.exec(raw);
  if (year) {
    attempts++;
    fields.year = year[1];
    hits++;
  }

  // Authors + title: split at the type identifier; before it the title trails.
  if (typeMatch && typeMatch.index > 0) {
    attempts++;
    const head = raw.slice(0, typeMatch.index).replace(/[.。]\s*$/, "");
    const dotIdx = head.search(/[.。]\s/);
    const authorPart = dotIdx > 0 ? head.slice(0, dotIdx) : head;
    const titlePart = dotIdx > 0 ? head.slice(dotIdx + 1).trim() : undefined;
    const authors = authorPart
      .split(/\s*[,，;；]\s*/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0 && !/^\d+$/.test(a));
    if (authors.length > 0 && authorPart.length <= 120) {
      fields.authors = authors;
      hits++;
    }
    if (titlePart && titlePart.length > 0) {
      fields.title = titlePart.replace(/[.。]$/, "");
      hits++;
    }
  }

  // Source (journal/publisher) — text between type bracket and the year/vol part.
  if (typeMatch) {
    attempts++;
    const afterType = raw.slice(typeMatch.index + typeMatch[0].length);
    const m = /^\s*[.。,，]\s*([^,，.。:：]{2,60}?)(?:,\s*\d{4}|,\s*\d{1,4}\s*\(|:\s|\.\s|$)/.exec(afterType);
    if (m) {
      fields.source = m[1]!.trim();
      hits++;
    }
  }

  let confidence: Confidence = "low";
  const ratio = attempts > 0 ? hits / attempts : 0;
  if (attempts >= 4 && ratio >= 0.8) confidence = "high";
  else if (attempts >= 2 && ratio >= 0.5) confidence = "medium";
  return { fields, confidence };
}
