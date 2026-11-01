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

/** Square-bracketed slot; GB/T 7714 puts the cited date (and only it) there. */
const BRACKET_SLOT = /[[［]([^\]］\n]{1,40})[\]］]/g;
/** Round brackets carry 创建/更新日期, which must never be read as a cited date. */
const DATE_SHAPED = /^\s*\d{4}\s*[./年-]\s*\d{1,2}\s*[./月-]\s*\d{1,2}\s*日?\s*$/;
const DATE_PARTS = /^\s*(\d{4})\s*[./年-]\s*(\d{1,2})\s*[./月-]\s*(\d{1,2})\s*日?\s*$/;

/** Exactly-four-digit candidates, boundaries not consumed so matches can abut. */
const YEAR_CANDIDATE = /(?:^|[^0-9A-Za-z])(\d{4})(?=[^0-9A-Za-z]|$)/g;
const PLAUSIBLE_YEAR = /^(1[5-9]\d{2}|20\d{2}|2100)$/;

/** Range tail keeping the separator as printed (～ — – included). */
const PAGES_RANGE_TAIL = /[:：]\s*(\d{1,5})\s*([-–—～~])\s*(\d{1,5})\s*[.。]?\s*$/;
/** Same range, but as the verbatim span so a fix preview can target it exactly. */
const PAGES_RANGE_SPAN = /(\d{1,5}\s*[-–—～~]\s*\d{1,5})(?=\s*[.。]?\s*$)/;
const PAGES_SINGLE_TAIL = /[:：]\s*(\d{1,5})\s*[.。]?\s*$/;
const VOL_ISSUE = /,\s*(\d{1,4})\s*\(([^()]{1,20})\)\s*[:：]/;

/** “出版地: 出版者/学位授予单位, 年…” — the shared tail shape of 表1/表6/表7. */
const PUB_WITH_PLACE = /^([^,，:：.。]{2,30}?)\s*[:：]\s*([^,，:：]{2,60}?)\s*[,，]\s*(?=\d{4})/;
/** 学位授予单位所在地 is 有则必备, so a thesis may legitimately omit the place. */
const PUB_NO_PLACE = /^([^,，:：.。]{2,60}?)\s*[,，]\s*(?=\d{4})/;

/** Types whose 著录格式 carries “出版地: 出版者/授予单位, 年”. */
const MONOGRAPH_TYPES = new Set(["D", "M", "C", "R", "N"]);

/**
 * Normalise a printed cited date to `YYYY-MM-DD`.
 * Returns undefined when the value is present but cannot be resolved to a real
 * date — that state must not be reported as “element absent”.
 */
export function normalizeCitedDate(printed: string): string | undefined {
  const m = DATE_PARTS.exec(printed);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!PLAUSIBLE_YEAR.test(String(year))) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${m[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** First square-bracketed slot holding a date-shaped value. */
function findCitedDateSlot(raw: string): string | undefined {
  BRACKET_SLOT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BRACKET_SLOT.exec(raw)) !== null) {
    const slot = m[1] ?? "";
    if (TYPE_ID.test(`[${slot}]`)) continue; // [EB/OL] etc.
    if (DATE_SHAPED.test(slot)) return slot.trim();
  }
  return undefined;
}

/**
 * First four-digit group that can plausibly be a publication year.
 * Standard numbers such as “GB/T 7714—2025” must not yield 7714 (V1.1.1).
 */
function firstPlausibleYear(raw: string): string | undefined {
  YEAR_CANDIDATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = YEAR_CANDIDATE.exec(raw)) !== null) {
    if (PLAUSIBLE_YEAR.test(m[1]!)) return m[1];
  }
  return undefined;
}

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

  const citedRaw = findCitedDateSlot(raw);
  if (citedRaw !== undefined) {
    attempts++;
    fields.citedDateRaw = citedRaw;
    fields.citedDate = normalizeCitedDate(citedRaw);
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

  const range = PAGES_RANGE_TAIL.exec(raw);
  if (range) {
    attempts++;
    const span = PAGES_RANGE_SPAN.exec(raw);
    fields.pagesRaw = span ? span[1] : `${range[1]}${range[2]}${range[3]}`;
    fields.pages = `${range[1]}-${range[3]}`;
    hits++;
  } else {
    const single = PAGES_SINGLE_TAIL.exec(raw);
    if (single) {
      attempts++;
      fields.pages = single[1];
      fields.pagesRaw = single[1];
      hits++;
    }
  }

  const year = firstPlausibleYear(raw);
  if (year) {
    attempts++;
    fields.year = year;
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

  // “出版地: 出版者/学位授予单位, 年…” — position-based extraction, not a keyword
  // list, so an awarding body naming neither 大学 nor 学院 is still recognised.
  if (typeMatch && MONOGRAPH_TYPES.has(fields.typeCode ?? "")) {
    attempts++;
    const afterType = raw
      .slice(typeMatch.index + typeMatch[0].length)
      .replace(/^\s*[.。]\s*/, "");
    const withPlace = PUB_WITH_PLACE.exec(afterType);
    if (withPlace) {
      fields.place = withPlace[1]!.trim();
      fields.publisher = withPlace[2]!.trim();
      hits++;
    } else if (fields.typeCode === "D") {
      // 学位授予单位所在地 is 有则必备: omitting the place is legitimate.
      const noPlace = PUB_NO_PLACE.exec(afterType);
      if (noPlace) {
        fields.publisher = noPlace[1]!.trim();
        hits++;
      }
    }
  }

  let confidence: Confidence = "low";
  const ratio = attempts > 0 ? hits / attempts : 0;
  if (attempts >= 4 && ratio >= 0.8) confidence = "high";
  else if (attempts >= 2 && ratio >= 0.5) confidence = "medium";
  return { fields, confidence };
}
