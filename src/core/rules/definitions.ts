/**
 * GB/T 7714 rule definitions.
 *
 * Clause numbering:
 * - 2025: 9.2 顺序编码制 (9.2.1.1 / 9.2.1.2 / 9.2.1.3 / 9.2.2), Annex A.
 *   Verified directly against the official standard text (verified-official).
 * - 2015: the corresponding clauses are 10.1.1 / 10.1.2 (第10章 参考文献标注法),
 *   and type codes in Annex B — confirmed via the official 2025 foreword's
 *   cross-reference list plus independent guides (verified-secondary).
 *
 * The full standard text is not redistributed; sources cite clause numbers
 * with short paraphrases only.
 */
import type { Issue, ReferenceEntry, RuleContext, RuleDefinition } from "../types";
import { codeTable, codesOnlyInOther } from "./tables";
import { normalizeCitedDate } from "../references/fields";
import { accessPathIsRequired, basisClause, citedDateIsRequired } from "./entry-requirements";

/** Draft issue: engine assigns id + standardVersion. */
type IssueDraft = Omit<Issue, "id" | "standardVersion">;

const OFFICIAL_2025 = "verified-official" as const;
const SECONDARY_2015 = "verified-secondary" as const;

function clauseFor(version: "2015" | "2025", c2025: string, c2015: string): string {
  return version === "2025" ? c2025 : c2015;
}

/** A cited date already in the prescribed form. */
const ISO_CITED_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Standard-number shapes, verified against the 8.9.3 and Annex B examples of
 * GB/T 7714—2025: an organisation code (optionally joined by “/” or “-”), an
 * optional group letter, then the number with its part dots.
 *   GB/T 7714  GB/T20090.16  IEC/IEEE 61636-1  IEEE P802.11ba  AIAA G-136
 *   ANSI/ANS-5.1  ISO/IEC 80079-20-2  GB 3000.1
 * Deliberately unanchored: a responsible body may precede the number. Lookbehind
 * is avoided so the bundle stays parseable on older WebKit.
 */
const STANDARD_NUMBER =
  /(?:^|[^A-Za-z])[A-Z]{2,6}(?:\s*[-/]\s*[A-Z]{1,6})*\s*[A-Z]?\s*[-\s]?\d[\d.]/;

/* ------------------------------------------------------------------ */
/* Helper predicates                                                   */
/* ------------------------------------------------------------------ */

function normalizeEntry(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[[［][A-Z]{1,2}(\/[A-Z]{1,2})?[\]］]/g, "") // strip [J] etc.
    .replace(/\d{4}-\d{2}-\d{2}/g, "") // cited dates differ
    .replace(/https?:\/\/\S+/g, "")
    .replace(/doi\s*[:：]?\s*10\.\S+/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function similarity(a: string, b: string): number {
  // Levenshtein-based ratio — sensitive to small differences, which is what
  // near-duplicate suspicion needs (e.g. the same entry with one page digit off).
  if (a.length < 6 || b.length < 6) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length]!;
}


/**
 * Build a no-fabrication fix preview for a non-ISO cited date: rewrite only
 * the date token inside the raw entry (zero-pad to YYYY-MM-DD). Returns
 * undefined when the date cannot be located mechanically.
 */
/**
 * A fix preview is offered only when the target span occurs exactly once in the
 * text the user is about to copy: never absent, never ambiguous, never a no-op.
 */
function previewFrom(
  anchorText: string,
  find: string,
  replace: string,
  description: string
): Issue["fixPreview"] | undefined {
  if (!find || !replace || find === replace) return undefined;
  const first = anchorText.indexOf(find);
  if (first < 0) return undefined;
  if (anchorText.indexOf(find, first + 1) !== -1) return undefined;
  return { find, replace, description };
}

/**
 * Either a safe mechanical fix, or an explicit statement of why none is
 * offered: a finding must never be silent about a fix it refused to guess.
 */
function mechanicalFix(
  anchorText: string,
  find: string,
  replace: string,
  description: string
): { fixPreview?: Issue["fixPreview"]; fixBlocked?: string } {
  const preview = previewFrom(anchorText, find, replace, description);
  if (preview) return { fixPreview: preview };
  const occurrences = find.length > 0 ? anchorText.split(find).length - 1 : 0;
  return {
    fixBlocked:
      occurrences > 1
        ? `原文中“${find}”出现 ${occurrences} 次，无法确定应修改哪一处，请手动修改。`
        : `未能在原文条目中定位“${find}”，请手动修改。`,
  };
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export const RULES: RuleDefinition[] = [
  {
    ruleId: "RR-CIT-001",
    standardVersions: ["2015", "2025"],
    category: "citation-reference-consistency",
    severity: "error",
    source: {
      clause: "9.2.1.1 / 9.2.2",
      priorClause: "10.1.1 / 10.1.2",
      summary:
        "顺序编码制：正文引用的序号应与参考文献表中实际存在的文献一一对应；参考文献表按正文标注的序号依次列出。",
      status: OFFICIAL_2025,
    },
    explanation:
      "检查每个正文引用编号是否能在参考文献列表中找到对应的条目。编号不存在通常意味着漏列文献或编号错误。",
    suggestedFix: "补充对应的参考文献条目，或改正正文中的引用编号。",
    check: (ctx: RuleContext) => {
      if (!ctx.scope.referenceSectionDetected) return [];
      const known = new Set(ctx.references.map((r) => r.index));
      const drafts: IssueDraft[] = [];
      for (const c of ctx.citations) {
        if (c.detection.needsReview) continue; // uncertain markers never produce deterministic errors
        const missing = [...new Set(c.numbers.filter((n) => !known.has(n)))];
        if (missing.length === 0) continue;
        drafts.push({
          ruleId: "RR-CIT-001",
          category: "citation-reference-consistency",
          severity: "error",
          messageKey: "issue.citationMissing",
          messageParams: { raw: c.raw, missing: missing.join(", ") },
          detail: `引用标记 ${c.raw} 中的编号 ${missing.join(", ")} 在参考文献列表中不存在。`,
          suggestion: "核对编号是否笔误；若确实引用了未列出的文献，请在参考文献表中补充该条目。",
          anchors: [c.anchor],
          source: {
            clause: clauseFor(ctx.version, "9.2.1.1 / 9.2.2", "10.1.1 / 10.1.2"),
            summary:
              "顺序编码制：正文引用的序号应与参考文献表中实际存在的文献一一对应。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: "high",
          requiresManualCheck: c.detection.needsReview,
          relatedIds: [c.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "citation to missing number produces error",
        input: {
          citations: [
            { id: "c1", raw: "[1]", numbers: [1], anchor: undefined },
            { id: "c2", raw: "[4]", numbers: [4], anchor: undefined },
          ],
          references: [{ id: "r1", index: 1 } as never],
          options: { referenceSectionDetected: true },
        },
        expect: { issueCount: 1, detailIncludes: ["4"], severity: "error" },
      },
    ],
  },

  {
    ruleId: "RR-REF-002",
    standardVersions: ["2015", "2025"],
    category: "numbering",
    severity: "error",
    source: {
      clause: "9.2.2",
      priorClause: "10.1.2",
      summary: "参考文献表按正文标注的序号依次列出，每篇文献对应一个序号，不应重复使用同一序号。",
      status: OFFICIAL_2025,
    },
    explanation: "检查参考文献列表中是否存在两个或多个条目使用同一个编号。",
    suggestedFix: "为重复编号的条目重新编号，并同步修正正文中的引用。",
    check: (ctx) => {
      const seen = new Map<number, ReferenceEntry>();
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        const prev = seen.get(r.index);
        if (prev) {
          drafts.push({
            ruleId: "RR-REF-002",
            category: "numbering",
            severity: "error",
            messageKey: "issue.duplicateNumber",
            messageParams: { index: r.index },
            detail: `参考文献编号 [${r.index}] 被多条条目使用。`,
            suggestion: "修改重复的编号并保持正文引用一致。",
            anchors: [prev.anchor, r.anchor],
            source: {
              clause: clauseFor(ctx.version, "9.2.2", "10.1.2"),
              summary: "参考文献表按正文标注的序号依次列出，每篇文献对应一个序号。",
              status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
            },
            confidence: "high",
            requiresManualCheck: false,
            relatedIds: [prev.id, r.id],
          });
        } else {
          seen.set(r.index, r);
        }
      }
      return drafts;
    },
    testCases: [
      {
        name: "duplicate entry numbers detected",
        input: {
          references: [
            { id: "r1", index: 2 },
            { id: "r2", index: 2 },
            { id: "r3", index: 3 },
          ],
        },
        expect: { issueCount: 1, severity: "error" },
      },
    ],
  },

  {
    ruleId: "RR-REF-003",
    standardVersions: ["2015", "2025"],
    category: "numbering",
    severity: "error",
    source: {
      clause: "9.2.2",
      priorClause: "10.1.2",
      summary: "顺序编码制的参考文献表按序号连续排列；序号应从 1 开始连续编码。",
      status: OFFICIAL_2025,
    },
    explanation:
      "检查参考文献编号是否连续（1、2、3……）。跳号通常意味着删除条目后未重新编号。自动编号或无编号列表将降低判定的确定性。",
    suggestedFix: "补齐缺失的编号或重新排列文献编号。",
    check: (ctx) => {
      if (ctx.references.length === 0) return [];
      const withNumbers = ctx.references.filter((r) => r.numberingKind !== "none");
      if (withNumbers.length === 0) return [];
      const indexes = withNumbers.map((r) => r.index);
      const max = Math.max(...indexes);
      const present = new Set(indexes);
      const gaps: number[] = [];
      for (let n = 1; n <= max; n++) if (!present.has(n)) gaps.push(n);
      const auto = withNumbers.some((r) => r.numberingKind === "auto");
      const drafts: IssueDraft[] = [];
      if (gaps.length > 0) {
        drafts.push({
          ruleId: "RR-REF-003",
          category: "numbering",
          severity: auto ? "review" : "error",
          messageKey: "issue.numberGap",
          messageParams: { gaps: gaps.slice(0, 10).join(", ") },
          detail: `参考文献编号存在缺口：${gaps.slice(0, 10).join(", ")}。`,
          suggestion: "检查是否漏排文献条目，或调整编号使序列连续。",
          anchors: withNumbers.slice(0, 3).map((r) => r.anchor),
          source: {
            clause: clauseFor(ctx.version, "9.2.2", "10.1.2"),
            summary: "顺序编码制的参考文献表按序号连续排列。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: auto ? "medium" : "high",
          requiresManualCheck: auto,
          relatedIds: [],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "gap in manual numbering detected",
        input: {
          references: [
            { id: "r1", index: 1, numberingKind: "manual" },
            { id: "r2", index: 3, numberingKind: "manual" },
          ],
        },
        expect: { issueCount: 1, detailIncludes: ["2"], severity: "error" },
      },
    ],
  },

  {
    ruleId: "RR-CIT-004",
    standardVersions: ["2015", "2025"],
    category: "numbering",
    severity: "error",
    source: {
      clause: "9.2.1.1",
      priorClause: "10.1.1",
      summary: "顺序编码制应按正文中引用的文献出现的先后顺序连续编码。",
      status: OFFICIAL_2025,
    },
    explanation:
      "按正文出现顺序，各文献的首次引用编号应为 1、2、3……连续递增。例如首次引用即为 [2] 或先出现 [3] 后出现 [2]，都说明编号未按出现顺序编排。",
    suggestedFix: "按正文首次出现顺序对参考文献重新编号。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      let expected = 1;
      let reported = false;
      const seenNumbers = new Set<number>();
      for (const c of ctx.citations) {
        if (c.detection.needsReview) continue; // uncertain markers skipped for order judgment
        for (const n of c.numbers) {
          if (seenNumbers.has(n)) continue;
          seenNumbers.add(n);
          if (n !== expected && !reported) {
            drafts.push({
              ruleId: "RR-CIT-004",
              category: "numbering",
              severity: "error",
              messageKey: "issue.firstOrder",
              messageParams: { got: String(n), expected: String(expected) },
              detail: `按出现顺序，第 ${expected} 处新引用的编号应为 [${expected}]，实际为 [${n}]。`,
              suggestion: "按正文首次出现顺序重新编号正文引用与参考文献表。",
              anchors: [c.anchor],
              source: {
                clause: clauseFor(ctx.version, "9.2.1.1", "10.1.1"),
                summary: "顺序编码制应按正文中引用的文献出现的先后顺序连续编码。",
                status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
              },
              confidence: "high",
              requiresManualCheck: false,
              relatedIds: [c.id],
            });
            reported = true;
          }
          expected = Math.max(expected, n + 1);
        }
      }
      return drafts;
    },
    testCases: [
      {
        name: "first citation out of order detected",
        input: {
          citations: [
            { id: "c1", raw: "[2]", numbers: [2] },
            { id: "c2", raw: "[1]", numbers: [1] },
          ],
        },
        expect: { issueCount: 1, detailIncludes: ["[2]"], severity: "error" },
      },
      {
        name: "sequential citations produce no issue",
        input: {
          citations: [
            { id: "c1", raw: "[1]", numbers: [1] },
            { id: "c2", raw: "[1-3]", numbers: [1, 2, 3] },
          ],
        },
        expect: { issueCount: 0 },
      },
    ],
  },

  {
    ruleId: "RR-REF-005",
    standardVersions: ["2015", "2025"],
    category: "reference-list",
    severity: "error",
    source: {
      clause: "9.2.2",
      priorClause: "10.1.2",
      summary: "参考文献表的条目应按序号从小到大依次排列。",
      status: OFFICIAL_2025,
    },
    explanation: "检查参考文献列表中条目的排列顺序是否与编号顺序一致（如 [2] 出现在 [1] 之前）。",
    suggestedFix: "按编号从小到大重新排列条目。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (let i = 1; i < ctx.references.length; i++) {
        const prev = ctx.references[i - 1]!;
        const cur = ctx.references[i]!;
        if (cur.index < prev.index) {
          drafts.push({
            ruleId: "RR-REF-005",
            category: "reference-list",
            severity: "error",
            messageKey: "issue.listOrder",
            messageParams: { prev: prev.index, cur: cur.index },
            detail: `参考文献表排列顺序异常：[${cur.index}] 出现在 [${prev.index}] 之后但编号更小。`,
            suggestion: "将条目按编号升序排列。",
            anchors: [prev.anchor, cur.anchor],
            source: {
              clause: clauseFor(ctx.version, "9.2.2", "10.1.2"),
              summary: "参考文献表的条目应按序号从小到大依次排列。",
              status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
            },
            confidence: "high",
            requiresManualCheck: false,
            relatedIds: [prev.id, cur.id],
          });
        }
      }
      return drafts;
    },
    testCases: [
      {
        name: "descending entries detected",
        input: {
          references: [
            { id: "r1", index: 2 },
            { id: "r2", index: 1 },
          ],
        },
        expect: { issueCount: 1, severity: "error" },
      },
    ],
  },

  {
    ruleId: "RR-CIT-006",
    standardVersions: ["2015", "2025"],
    category: "citation-reference-consistency",
    severity: "error",
    source: {
      clause: "9.2.1.2",
      priorClause: "10.1.1",
      summary: "同一处引用多篇文献时，序号在“[ ]”内全部列出，连续序号用短横线连接；起讫序号应有效。",
      status: OFFICIAL_2025,
    },
    explanation: "检查引用区间是否结构有效：起号应不大于讫号（如 [5-2] 为倒置区间），单号区间（如 [3-3]）建议直接写作 [3]。",
    suggestedFix: "修正区间端点或改用单个编号。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const c of ctx.citations) {
        for (const seg of c.segments) {
          if (seg.kind === "range" && seg.start > seg.end) {
            drafts.push({
              ruleId: "RR-CIT-006",
              category: "citation-reference-consistency",
              severity: "error",
              messageKey: "issue.invertedRange",
              messageParams: { raw: c.raw, start: seg.start, end: seg.end },
              detail: `引用区间倒置：${c.raw} 中 ${seg.start}-${seg.end} 起号大于讫号。`,
              suggestion: "交换区间端点（如 2-5）或改写为逐个列出。",
              anchors: [c.anchor],
              source: {
                clause: clauseFor(ctx.version, "9.2.1.2", "10.1.1"),
                summary: "起讫序号间用短横线连接，区间应有效。",
                status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
              },
              confidence: "high",
              requiresManualCheck: false,
              relatedIds: [c.id],
            });
          } else if (seg.kind === "range" && seg.start === seg.end) {
            drafts.push({
              ruleId: "RR-CIT-006",
              category: "citation-reference-consistency",
              severity: "warning",
              messageKey: "issue.degenerateRange",
              messageParams: { raw: c.raw, start: seg.start },
              detail: `区间 ${seg.start}-${seg.end} 起讫相同，应直接写作 [${seg.start}]。`,
              suggestion: "将 [3-3] 形式改为 [3]。",
              anchors: [c.anchor],
              source: {
                clause: clauseFor(ctx.version, "9.2.1.2", "10.1.1"),
                summary: "连续序号起讫序号间用短横线连接。",
                status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
              },
              confidence: "high",
              requiresManualCheck: false,
              relatedIds: [c.id],
            });
          }
        }
      }
      return drafts;
    },
    testCases: [
      {
        name: "inverted range detected",
        input: {
          citations: [
            {
              id: "c1",
              raw: "[5-2]",
              numbers: [],
              segments: [{ kind: "range", start: 5, end: 2, rawStart: 1, rawEnd: 4 }],
            },
          ],
        },
        expect: { issueCount: 1, detailIncludes: ["5"], severity: "error" },
      },
    ],
  },

  {
    ruleId: "RR-REF-007",
    standardVersions: ["2015", "2025"],
    category: "reference-list",
    severity: "error",
    source: {
      clause: "9.2.1.3",
      priorClause: "10.1.1",
      summary:
        "多次引用同一文献时，标注首次引用的文献序号；同一文献在参考文献表中不应重复著录两条。",
      status: OFFICIAL_2025,
    },
    explanation:
      "检查参考文献表中是否存在内容完全相同的条目（重复著录）。高度相似的条目会标记为疑似重复，需人工确认。",
    suggestedFix: "删除重复条目并统一正文引用编号。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      const norm = ctx.references.map((r) => ({ r, key: normalizeEntry(r.raw) }));
      for (let i = 0; i < norm.length; i++) {
        for (let j = i + 1; j < norm.length; j++) {
          const a = norm[i]!;
          const b = norm[j]!;
          if (!a.key || !b.key) continue;
          if (a.key === b.key) {
            drafts.push({
              ruleId: "RR-REF-007",
              category: "reference-list",
              severity: "error",
              messageKey: "issue.duplicateEntry",
              messageParams: { a: a.r.index, b: b.r.index },
              detail: `参考文献 [${a.r.index}] 与 [${b.r.index}] 内容相同（重复著录）。`,
              suggestion: "删除重复条目，正文引用统一指向保留条目的编号。",
              anchors: [a.r.anchor, b.r.anchor],
              source: {
                clause: clauseFor(ctx.version, "9.2.1.3", "10.1.1"),
                summary: "多次引用同一文献时标注首次引用的序号，不应重复著录。",
                status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
              },
              confidence: "high",
              requiresManualCheck: false,
              relatedIds: [a.r.id, b.r.id],
            });
          } else if (similarity(a.key, b.key) > 0.85) {
            drafts.push({
              ruleId: "RR-REF-007",
              category: "reference-list",
              severity: "review",
              messageKey: "issue.suspectedDuplicate",
              messageParams: { a: a.r.index, b: b.r.index },
              detail: `参考文献 [${a.r.index}] 与 [${b.r.index}] 高度相似，疑似同一文献的重复著录，请人工确认。`,
              suggestion: "比对两条文献的版本、页码等信息，确认是否重复。",
              anchors: [a.r.anchor, b.r.anchor],
              source: {
                clause: clauseFor(ctx.version, "9.2.1.3", "10.1.1"),
                summary: "同一文献不应重复著录。",
                status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
              },
              confidence: "medium",
              requiresManualCheck: true,
              relatedIds: [a.r.id, b.r.id],
            });
          }
        }
      }
      return drafts;
    },
    testCases: [
      {
        name: "identical entries flagged",
        input: {
          references: [
            { id: "r1", index: 1, raw: "张三. 某研究[J]. 学报, 2020, 1(2): 1-9." },
            { id: "r2", index: 2, raw: "张三. 某研究[J]. 学报, 2020, 1(2): 1-9." },
          ],
        },
        expect: { issueCount: 1, severity: "error" },
      },
    ],
  },

  {
    ruleId: "RR-FMT-008",
    standardVersions: ["2015", "2025"],
    category: "type-identifier",
    severity: "warning",
    source: {
      clause: "Annex A",
      priorClause: "Annex B",
      summary: "文献类型标识与载体标识应使用标准附录规定的代码。",
      status: OFFICIAL_2025,
    },
    explanation:
      "检查条目中的文献类型/载体标识代码是否属于所选标准版本定义的代码表。未定义代码通常意味着笔误或版本混用。",
    suggestedFix: "核对类型代码是否符合所选版本的附录规定。",
    check: (ctx) => {
      const table = codeTable(ctx.version);
      const other = codesOnlyInOther(ctx.version);
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        const code = r.fields.typeCode;
        if (!code) continue;
        if (table.typeCodes[code]) continue;
        const isNewInOther = other.types.includes(code);
        drafts.push({
          ruleId: "RR-FMT-008",
          category: "type-identifier",
          severity: "warning",
          messageKey: "issue.unknownTypeCode",
          messageParams: { code, index: r.index, version: ctx.version },
          detail: `参考文献 [${r.index}] 的文献类型标识 [${r.fields.typeIdentifier ?? code}] 在 GB/T 7714—${ctx.version} 的代码表中未定义${
            isNewInOther ? `（${code} 为${ctx.version === "2015" ? "2025" : "2015"} 版代码）` : ""
          }。`,
          suggestion: `核对文献类型代码；GB/T 7714—${ctx.version} 允许的代码见检查依据。`,
          anchors: [r.anchor],
          source: {
            clause: ctx.version === "2025" ? "Annex A" : "Annex B",
            summary: "文献类型标识与载体标识应使用标准附录规定的代码。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: "high",
          requiresManualCheck: false,
          relatedIds: [r.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "DS code rejected under 2015",
        version: "2015",
        input: {
          references: [
            { id: "r1", index: 1, raw: "某数据集[DS/OL]. 平台, 2024.", fields: { typeCode: "DS", typeIdentifier: "[DS/OL]", carrierCode: "OL" } },
          ],
          options: { version: "2015" },
        },
        expect: { issueCount: 1, detailIncludes: ["DS"], severity: "warning" },
      },
    ],
  },

  {
    ruleId: "RR-FMT-010",
    standardVersions: ["2015", "2025"],
    category: "entry-format",
    severity: "review",
    source: {
      clause: "6.2 / 7.2",
      priorClause: "7.2",
      summary:
        "著录用符号为前置符：“.”用于题名等之前，“:”用于出版者、页码等之前，“[ ]”用于文献类型标识等。条目应可按该结构识别出题名与类型标识。",
      status: OFFICIAL_2025,
    },
    explanation:
      "仅当能可靠解析条目结构时才判定：条目缺少文献类型标识（如 [J]、[M]）时提示人工复核。解析置信度低时不作格式结论。",
    suggestedFix: "为条目补充文献类型标识。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        if (r.fields.typeIdentifier) continue;
        if (r.raw.length < 8) continue;
        drafts.push({
          ruleId: "RR-FMT-010",
          category: "entry-format",
          severity: "review",
          messageKey: "issue.missingTypeIdentifier",
          messageParams: { index: r.index },
          detail: `参考文献 [${r.index}] 未见文献类型标识（如 [J]、[M]），无法自动确认著录结构，请人工复核。`,
          suggestion: "按 GB/T 7714 为条目补充文献类型标识。",
          anchors: [r.anchor],
          source: {
            clause: clauseFor(ctx.version, "6.2 / 7.3", "7.2 / 8"),
            summary: "文献类型标识置于“[ ]”中，是条目结构的可识别组成部分。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: "medium",
          requiresManualCheck: true,
          relatedIds: [r.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "entry without type identifier flagged for review",
        input: {
          references: [
            { id: "r1", index: 1, raw: "张三. 某某研究论文. 某大学出版社, 2020." },
          ],
        },
        expect: { issueCount: 1, severity: "review" },
      },
    ],
  },

  {
    ruleId: "RR-FMT-011",
    standardVersions: ["2015", "2025"],
    category: "entry-format",
    severity: "warning",
    source: {
      clause: "6.2",
      priorClause: "7.2",
      summary: "起讫页码间应使用短横线“-”连接（“-”用于起讫页码、起讫序号间）。",
      status: OFFICIAL_2025,
    },
    explanation:
      "页码起讫应使用半角短横线“-”（如 24-33）。使用全角波浪线（～）、全角破折号（—）或 en dash（–）连接页码不符合著录用符号规定。",
    suggestedFix: "将页码间的连接符改为半角短横线“-”。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        // Read the printed span: the normalised `pages` no longer contains the
        // separator this rule exists to police.
        const pages = r.fields.pagesRaw;
        if (!pages) continue;
        const range = /^(\d{1,5})\s*([-–—～~])\s*(\d{1,5})$/.exec(pages);
        if (!range || range[2] === "-") continue;
        const normalized = `${range[1]}-${range[3]}`;
        drafts.push({
          ruleId: "RR-FMT-011",
          category: "entry-format",
          severity: "warning",
          messageKey: "issue.pagesDash",
          messageParams: { index: r.index, pages },
          detail: `参考文献 [${r.index}] 页码“${pages}”未使用短横线“-”连接起讫页码。`,
          suggestion: "按著录用符号规定，将页码连接符改为半角短横线，如 24-33。",
          ...mechanicalFix(
            r.anchor.text,
            pages,
            normalized,
            `将页码连接符规范化为短横线（${pages} → ${normalized}）`
          ),
          anchors: [r.anchor],
          source: {
            clause: clauseFor(ctx.version, "6.2", "7.2"),
            summary: "起讫页码间用短横线“-”连接。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: "high",
          requiresManualCheck: false,
          relatedIds: [r.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "wave-dash page range flagged",
        input: {
          references: [
            {
              id: "r1",
              index: 1,
              raw: "张三. 某文[J]. 学报, 2020, 1(2): 24～33.",
              fields: { pages: "24-33", pagesRaw: "24～33" },
            },
          ],
        },
        expect: { issueCount: 1, detailIncludes: ["24～33"], severity: "warning" },
      },
      {
        name: "hyphen page range passes",
        input: {
          references: [
            { id: "r1", index: 1, raw: "张三. 某文[J]. 学报, 2020, 1(2): 24-33.", fields: { pages: "24-33", pagesRaw: "24-33" } },
          ],
        },
        expect: { issueCount: 0 },
      },
    ],
  },

  {
    ruleId: "RR-FMT-013",
    standardVersions: ["2015", "2025"],
    category: "entry-format",
    severity: "warning",
    source: {
      clause: "8.11.2.1 表10 / 8.11.3.1 表11 / 8.14.2 表14 / 8.15.1 表15",
      priorClause: "8.4.4",
      summary:
        "引用日期为必备著录项目的类型：网站（表10）、网页（表11）、数据集（表14）、预印本（表15）。其他类型的著录项目表不含引用日期项（如期刊析出表4、图书表1、报告表7、专利表9、标准表8、学位论文表6），其联机形式按各自表格无引用日期要求。",
      status: OFFICIAL_2025,
    },
    explanation:
      "引用日期的必备性因文献类型而异（v1.1 审计修正，v1.1.1 补网页表11）：网站网页、数据集、预印本缺引用日期按警告处理；期刊、图书、学位论文、报告、专利、标准等类型的联机条目不检查引用日期（标准自身示例亦无）。条目已著录但格式不规范时改由格式检查提示，不再重复报“缺引用日期”。2015 版将引用日期作为电子资源统一要求，故其他 /OL 类型在 2015 下降为待复核。",
    suggestedFix: "为条目补充引用日期 [YYYY-MM-DD]。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        // A printed date — even a badly formatted one — means the element is
        // present. Reporting “missing cited date” on such an entry is the exact
        // contradiction RR-FMT-017 exists to resolve (V1.1.1).
        if (r.fields.citedDateRaw !== undefined) continue;
        const code = r.fields.typeCode ?? "";
        // 2025: 引用日期必备 = EB(表10/表11) + DS(表14) + PP(表15)
        if (ctx.version === "2025") {
          if (!citedDateIsRequired(ctx.version, code)) continue;
          drafts.push({
            ruleId: "RR-FMT-013",
            category: "entry-format",
            severity: "warning",
            messageKey: "issue.missingCitedDate",
            messageParams: { index: r.index },
            detail: `参考文献 [${r.index}] 为${
              code === "EB" ? "网站、网页" : code === "DS" ? "数据集" : "预印本"
            }类文献，引用日期为必备著录项目，但条目中未见引用日期。`,
            suggestion: "补充引用日期，如 [2025-01-15]。",
            anchors: [r.anchor],
            source: {
              clause: basisClause(ctx.version, "citedDate", code, "8.11.2.1 表10 / 8.14.2 表14 / 8.15.1 表15"),
              summary: "网站网页、数据集、预印本的引用日期为必备项。",
              status: OFFICIAL_2025,
            },
            confidence: "high",
            requiresManualCheck: false,
            relatedIds: [r.id],
          });
        } else {
          // 2015: 电子资源统一要求引用日期（8.4.4，verified-secondary）；
          // EB 按警告，其余 /OL 类型按待复核以避免确定性误报。
          if (r.fields.carrierCode !== "OL") continue;
          const isEB = code === "EB";
          drafts.push({
            ruleId: "RR-FMT-013",
            category: "entry-format",
            severity: isEB ? "warning" : "review",
            messageKey: "issue.missingCitedDate",
            messageParams: { index: r.index },
            detail: isEB
              ? `参考文献 [${r.index}] 为电子公告类文献，未见引用日期 [YYYY-MM-DD]。`
              : `参考文献 [${r.index}] 为联机文献；2015 版对电子资源统一要求引用日期，但部分类型的实践存在差异，请人工确认。`,
            suggestion: "补充引用日期，如 [2025-01-15]。",
            anchors: [r.anchor],
            source: {
              clause: "8.4.4",
              summary: "2015 版电子资源著录项目含引用日期。",
              status: SECONDARY_2015,
            },
            confidence: isEB ? "high" : "medium",
            requiresManualCheck: !isEB,
            relatedIds: [r.id],
          });
        }
      }
      return drafts;
    },
    testCases: [
      {
        name: "EB entry without cited date flagged (warning)",
        input: {
          references: [
            {
              id: "r1",
              index: 1,
              raw: "某作者. 在线文章[EB/OL]. (2024-05-01). https://example.org/a.",
              fields: { typeCode: "EB", carrierCode: "OL", typeIdentifier: "[EB/OL]" },
            },
          ],
        },
        expect: { issueCount: 1, severity: "warning" },
      },
      {
        name: "J/OL entry without cited date is legitimate (standard example form)",
        version: "2025",
        input: {
          references: [
            {
              id: "r1",
              index: 1,
              raw: "张群, 程志宝, 石志飞. 惯性增强动力吸振器研究[J/OL]. 快速学报, 2024-05-09. https://kns.cnki.net/a.",
              fields: { typeCode: "J", carrierCode: "OL", typeIdentifier: "[J/OL]" },
            },
          ],
        },
        expect: { issueCount: 0 },
      },
      {
        name: "D/OL entry without cited date is legitimate under 2025",
        version: "2025",
        input: {
          references: [
            {
              id: "r1",
              index: 1,
              raw: "金燕萍. 社交媒体时代的虚假信息研究[D/OL]. 温州: 温州大学, 2020: 16. https://d.wanfangdata.com.cn/x.",
              fields: { typeCode: "D", carrierCode: "OL", typeIdentifier: "[D/OL]" },
            },
          ],
        },
        expect: { issueCount: 0 },
      },
      {
        name: "D/OL entry without cited date → review under 2015",
        version: "2015",
        input: {
          references: [
            {
              id: "r1",
              index: 1,
              raw: "金燕萍. 社交媒体时代的虚假信息研究[D/OL]. 温州: 温州大学, 2020: 16. https://d.wanfangdata.com.cn/x.",
              fields: { typeCode: "D", carrierCode: "OL", typeIdentifier: "[D/OL]" },
            },
          ],
        },
        expect: { issueCount: 1, severity: "review" },
      },
      {
        name: "DS entry with cited date passes",
        version: "2025",
        input: {
          references: [
            {
              id: "r1",
              index: 1,
              raw: "某中心. 数据集[DS/OL]. 平台, 2024-01-01[2025-01-01]. https://example.com.",
              fields: { typeCode: "DS", carrierCode: "OL", typeIdentifier: "[DS/OL]", citedDateRaw: "2025-01-01", citedDate: "2025-01-01" },
            },
          ],
        },
        expect: { issueCount: 0 },
      },
    ],
  },

  {
    ruleId: "RR-FMT-014",
    standardVersions: ["2025"],
    category: "entry-format",
    severity: "warning",
    source: {
      clause: "8.11.2.1 表10 / 8.11.3.1 表11 / 8.14.2 表14 / 8.15.1 表15",
      summary:
        "获取和访问路径为必备著录项目：网站（表10）、网页（表11）、预印本（表15）无条件必备；数据集（表14）为电子资源必备。",
      status: OFFICIAL_2025,
    },
    explanation:
      "网站、网页、预印本必须著录获取和访问路径（URL）；数据集按表14 在作为电子资源时必备（表A.2 的 MT/DK/CD/OL/MM 均为电子资源载体）。缺失时读者无法定位该资源。",
    suggestedFix: "补充资源的获取和访问路径（URL）。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        const code = r.fields.typeCode ?? "";
        if (!accessPathIsRequired(ctx.version, code, r.fields.carrierCode)) continue;
        if (r.fields.url) continue;
        drafts.push({
          ruleId: "RR-FMT-014",
          category: "entry-format",
          severity: "warning",
          messageKey: "issue.missingUrl",
          messageParams: { index: r.index, type: code === "EB" ? "网站、网页" : code === "DS" ? "数据集" : "预印本" },
          detail: `参考文献 [${r.index}] 为${
            code === "EB" ? "网站、网页" : code === "DS" ? "数据集" : "预印本"
          }类文献，获取和访问路径为必备著录项目，但未见 URL。`,
          suggestion: "补充资源的获取和访问路径（URL）。",
          anchors: [r.anchor],
          source: {
            clause: basisClause(ctx.version, "accessPath", code, "8.11.2.1 表10 / 8.14.2 表14 / 8.15.1 表15"),
            summary: `${
              code === "EB" ? "网站、网页" : code === "DS" ? "数据集（电子资源）" : "预印本"
            }的获取和访问路径为必备。`,
            status: OFFICIAL_2025,
          },
          confidence: "high",
          requiresManualCheck: false,
          relatedIds: [r.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "EB entry without URL flagged",
        input: {
          references: [
            { id: "r1", index: 1, raw: "某作者. 网页[EB/OL]. [2025-01-15].", fields: { typeCode: "EB", carrierCode: "OL", citedDate: "2025-01-15" } },
          ],
        },
        expect: { issueCount: 1, severity: "warning" },
      },
      {
        name: "EB entry with URL passes",
        input: {
          references: [
            { id: "r1", index: 1, raw: "某作者. 网页[EB/OL]. [2025-01-15]. https://example.org.", fields: { typeCode: "EB", carrierCode: "OL", citedDate: "2025-01-15", url: "https://example.org" } },
          ],
        },
        expect: { issueCount: 0 },
      },
    ],
  },

  {
    ruleId: "RR-FMT-015",
    standardVersions: ["2015", "2025"],
    category: "entry-format",
    severity: "review",
    source: {
      clause: "8.7.1 表6",
      priorClause: "4.5",
      summary: "学位论文的学位授予单位为必备著录项目；学位授予年、引文页码为有则必备。",
      status: OFFICIAL_2025,
    },
    explanation:
      "学位论文条目应著录学位授予单位（必备）。仅当条目解析置信度足够而结构中未见授予单位时提示；解析不可靠时不作判断。",
    suggestedFix: "补充学位授予单位，如 “…[D]. 北京: 中国科学院大学, 2022.”",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        if (r.fields.typeCode !== "D") continue;
        if (r.fieldsConfidence === "low") continue; // unreliable parse → no conclusion
        if (r.fields.publisher || r.fields.place) continue; // institution parsed
        // High-structure D entries almost always read “地: 单位, 年”. If neither
        // place nor publisher was found while the year was, flag for review.
        if (!r.fields.year) continue;
        drafts.push({
          ruleId: "RR-FMT-015",
          category: "entry-format",
          severity: "review",
          messageKey: "issue.missingInstitution",
          messageParams: { index: r.index },
          detail: `参考文献 [${r.index}] 为学位论文，未见学位授予单位（必备项），请人工确认。`,
          suggestion: "补充学位授予单位，如 “…[D]. 北京: 中国科学院大学, 2022.”",
          anchors: [r.anchor],
          source: {
            clause: clauseFor(ctx.version, "8.7.1 表6", "4.5"),
            summary: "学位论文的学位授予单位为必备著录项目。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: "medium",
          requiresManualCheck: true,
          relatedIds: [r.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "D entry without institution flagged for review",
        input: {
          references: [
            { id: "r1", index: 1, raw: "张三. 某研究[D]. 2022.", fields: { typeCode: "D", year: "2022" }, fieldsConfidence: "medium" },
          ],
        },
        expect: { issueCount: 1, severity: "review" },
      },
      {
        name: "D entry with institution passes",
        input: {
          references: [
            { id: "r1", index: 1, raw: "王琦. 融合星载GNSS-R和SAR数据的研究[D]. 武汉: 武汉大学, 2022: 87.", fields: { typeCode: "D", publisher: "武汉大学", place: "武汉", year: "2022" }, fieldsConfidence: "high" },
          ],
        },
        expect: { issueCount: 0 },
      },
    ],
  },

  {
    ruleId: "RR-FMT-016",
    standardVersions: ["2015", "2025"],
    category: "entry-format",
    severity: "review",
    source: {
      clause: "8.5.1 / 8.5.2 表4",
      priorClause: "8.8",
      summary:
        "期刊析出文献应注明年、卷、期、页码等（年卷期标识与页码为有则必备）；文章编号或在线出版日期可替代页码（8.5.1.1 示例6、示例7）。",
      status: OFFICIAL_2025,
    },
    explanation:
      "仅当期刊条目完全未见出版年时提示待复核（有则必备，不能确定性判错）。缺页码不提示：文章编号（示例6）与在线优先出版（示例7，仅日期）均为合法形式。",
    suggestedFix: "核对并补充期刊出版年及卷期页码信息。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        if (r.fields.typeCode !== "J") continue;
        if (r.fieldsConfidence === "low") continue;
        if (r.fields.year) continue;
        drafts.push({
          ruleId: "RR-FMT-016",
          category: "entry-format",
          severity: "review",
          messageKey: "issue.journalNoYear",
          messageParams: { index: r.index },
          detail: `参考文献 [${r.index}] 为期刊析出文献，未见出版年（年卷期/页码为有则必备项），请人工确认。`,
          suggestion: "核对并补充期刊出版年及卷期页码信息。",
          anchors: [r.anchor],
          source: {
            clause: clauseFor(ctx.version, "8.5.1 / 8.5.2 表4", "8.8"),
            summary: "期刊析出文献应注明年卷期页码等（有则必备）。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: "medium",
          requiresManualCheck: true,
          relatedIds: [r.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "J entry without year flagged for review",
        input: {
          references: [
            { id: "r1", index: 1, raw: "张三. 某研究[J]. 某学报.", fields: { typeCode: "J" }, fieldsConfidence: "medium" },
          ],
        },
        expect: { issueCount: 1, severity: "review" },
      },
      {
        name: "J entry with article number instead of pages is legitimate",
        input: {
          references: [
            { id: "r1", index: 1, raw: "李四. 某研究[J]. 学报, 2023, 267: 147370.", fields: { typeCode: "J", year: "2023", volume: "267", pages: "147370" }, fieldsConfidence: "high" },
          ],
        },
        expect: { issueCount: 0 },
      },
    ],
  },

  {
    ruleId: "RR-FMT-017",
    standardVersions: ["2015", "2025"],
    category: "entry-format",
    severity: "warning",
    source: {
      clause: "7.6",
      priorClause: "8.4.4",
      summary: "电子资源的引用日期应按 YYYY-MM-DD 格式、用阿拉伯数字著录。",
      status: OFFICIAL_2025,
    },
    explanation: "引用日期已著录但格式不符合 YYYY-MM-DD（如 2025.1.15、2025/01/15、2025年1月15日）时提示修正。",
    suggestedFix: "将引用日期改为 YYYY-MM-DD 格式，如 [2025-01-15]。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        // Compare the printed value: `citedDate` is already normalised, so
        // testing it could never reveal a format problem (V1.1.1).
        const printed = r.fields.citedDateRaw;
        if (printed === undefined) continue;
        const iso = normalizeCitedDate(printed);
        // Well-shaped AND resolvable is the only clean state: “2025-13-45” has
        // the ISO shape but no such date, which is neither valid nor absent.
        if (ISO_CITED_DATE.test(printed) && iso !== undefined) continue;
        const resolvable = iso !== undefined;
        drafts.push({
          ruleId: "RR-FMT-017",
          category: "entry-format",
          severity: "warning",
          messageKey: "issue.citedDateFormat",
          messageParams: { index: r.index, date: printed },
          detail: resolvable
            ? `参考文献 [${r.index}] 的引用日期“${printed}”不符合 YYYY-MM-DD 格式。`
            : `参考文献 [${r.index}] 的引用日期“${printed}”无法解析为有效日期，请核对。`,
          suggestion: resolvable
            ? "将引用日期改为 YYYY-MM-DD 格式，如 [2025-01-15]。"
            : "核对并补充正确的引用日期，格式为 [YYYY-MM-DD]。",
          anchors: [r.anchor],
          source: {
            clause: clauseFor(ctx.version, "7.6", "8.4.4"),
            summary: "引用日期应按 YYYY-MM-DD 格式、用阿拉伯数字著录。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: "high",
          requiresManualCheck: !resolvable,
          relatedIds: [r.id],
          ...(iso !== undefined
            ? mechanicalFix(r.anchor.text, printed, iso, `将引用日期 ${printed} 规范化为 ${iso}`)
            : { fixBlocked: `引用日期“${printed}”不是有效日期，无法确定正确值，请手动核对。` }),
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "non-ISO cited date flagged",
        input: {
          references: [
            { id: "r1", index: 1, raw: "某作者. 网页[EB/OL]. [2025.1.15]. https://example.org.", fields: { typeCode: "EB", citedDateRaw: "2025.1.15", citedDate: "2025-01-15" } },
          ],
        },
        expect: { issueCount: 1, severity: "warning" },
      },
      {
        name: "ISO cited date passes",
        input: {
          references: [
            { id: "r1", index: 1, raw: "某作者. 网页[EB/OL]. [2025-01-15]. https://example.org.", fields: { typeCode: "EB", citedDateRaw: "2025-01-15", citedDate: "2025-01-15" } },
          ],
        },
        expect: { issueCount: 0 },
      },
    ],
  },

  {
    ruleId: "RR-FMT-018",
    standardVersions: ["2015", "2025"],
    category: "entry-format",
    severity: "warning",
    source: {
      clause: "8.9.1 表8 / 8.9.2",
      priorClause: "4.4",
      summary: "标准文献应著录标准编号（必备）与标准名称（必备），编号置于条目开头。",
      status: OFFICIAL_2025,
    },
    explanation:
      "标准文献条目应著录标准编号（表8 必备），通常形如 GB/T 7714—2025、IEC/IEEE 61636-1、IEEE P802.11ba、AIAA G-136、ANSI/ANS-5.1。编号置于条目开头，但责任者写在编号之前同样能识别到编号，不判为缺失。",
    suggestedFix: "在条目开头补充标准编号，如 “GB/T 7714—2025 信息与文献 参考文献著录规则[S].”",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        if (r.fields.typeCode !== "S") continue;
        if (STANDARD_NUMBER.test(r.raw)) continue;
        drafts.push({
          ruleId: "RR-FMT-018",
          category: "entry-format",
          severity: "warning",
          messageKey: "issue.missingStandardNumber",
          messageParams: { index: r.index },
          detail: `参考文献 [${r.index}] 为标准文献，未见标准编号（必备项），条目应以编号开头（如 GB/T 7714—2025）。`,
          suggestion: "在条目开头补充标准编号与名称。",
          anchors: [r.anchor],
          source: {
            clause: clauseFor(ctx.version, "8.9.1 表8", "4.4"),
            summary: "标准文献应著录标准编号（必备）。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          // Number shapes vary widely; a negative finding always deserves a look.
          confidence: "medium",
          requiresManualCheck: true,
          relatedIds: [r.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "S entry without standard number flagged",
        input: {
          references: [
            { id: "r1", index: 1, raw: "信息与文献 参考文献著录规则[S]. 北京: 中国标准出版社, 2015.", fields: { typeCode: "S" } },
          ],
        },
        expect: { issueCount: 1, severity: "warning" },
      },
      {
        name: "S entry with standard number passes",
        input: {
          references: [
            { id: "r1", index: 1, raw: "GB/T 7714—2025 信息与文献 参考文献著录规则[S]. 北京: 中国标准出版社, 2025.", fields: { typeCode: "S" } },
          ],
        },
        expect: { issueCount: 0 },
      },
    ],
  },

  {
    ruleId: "RR-REF-011",
    standardVersions: ["2015", "2025"],
    category: "reference-list",
    severity: "info",
    source: {
      clause: "9.2.2",
      priorClause: "10.1.2",
      summary: "未被正文引用的文献条目属于提示信息，不构成标准违规。",
      status: OFFICIAL_2025,
    },
    explanation: "列出了但从未被正文引用的文献。这是提示信息；是否删除取决于论文写作要求。",
    check: (ctx) => {
      if (!ctx.scope.referenceSectionDetected) return [];
      // Reference-list-only input (paste mode without body text): "uncited"
      // cannot be judged — suppress instead of flagging every entry (V1.1.2).
      if (ctx.scope.bodyless) return [];
      const cited = new Set(ctx.relations.map((rel) => rel.number));
      const drafts: IssueDraft[] = [];
      for (const r of ctx.references) {
        if (cited.has(r.index)) continue;
        drafts.push({
          ruleId: "RR-REF-011",
          category: "reference-list",
          severity: "info",
          messageKey: "issue.uncitedEntry",
          messageParams: { index: r.index },
          detail: `参考文献 [${r.index}] 未在正文中找到引用。`,
          suggestion: "确认是否遗漏正文引用，或按学校要求决定是否保留。",
          anchors: [r.anchor],
          source: {
            clause: clauseFor(ctx.version, "9.2.2", "10.1.2"),
            summary: "顺序编码制下文献表按正文标注序号列出；未被引用的条目作为提示信息报告。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: "high",
          requiresManualCheck: true,
          relatedIds: [r.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "uncited entry reported as info",
        input: {
          citations: [{ id: "c1", raw: "[1]", numbers: [1] } as never],
          references: [{ id: "r1", index: 1 }, { id: "r2", index: 2 } as never],
          relations: [{ citationId: "c1", referenceId: "r1", number: 1, missing: false } as never],
        },
        expect: { issueCount: 1, severity: "info" },
      },
    ],
  },

  {
    ruleId: "RR-SCOPE-012",
    standardVersions: ["2015", "2025"],
    category: "scope",
    severity: "warning",
    source: {
      clause: "9.2",
      priorClause: "10.1",
      summary: "顺序编码制要求存在可对应的参考文献表。",
      status: OFFICIAL_2025,
    },
    explanation: "文档中检测到编号引用，但未能定位参考文献列表，无法进行对应性检查。",
    suggestedFix: "确认参考文献列表是否使用了不常见的标题或格式。",
    check: (ctx) => {
      if (ctx.scope.referenceSectionDetected) return [];
      if (ctx.citations.length === 0) return [];
      const draft: IssueDraft = {
        ruleId: "RR-SCOPE-012",
        category: "scope",
        severity: "warning",
        messageKey: "issue.noReferenceList",
        detail: "未能在文档中定位参考文献列表；引用编号无法与文献对应核查。",
        suggestion: "检查参考文献部分是否使用了特殊标题，或未使用列表形式。",
        anchors: ctx.citations.slice(0, 3).map((c) => c.anchor),
        source: {
          clause: clauseFor(ctx.version, "9.2", "10.1"),
          summary: "顺序编码制要求存在按序号组织的参考文献表。",
          status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
        },
        confidence: "high",
        requiresManualCheck: true,
        relatedIds: [],
      };
      return [draft];
    },
    testCases: [
      {
        name: "citations without reference list produce warning",
        input: {
          citations: [{ id: "c1", raw: "[1]", numbers: [1] } as never],
          options: { referenceSectionDetected: false },
        },
        expect: { issueCount: 1, severity: "warning" },
      },
    ],
  },

  {
    ruleId: "RR-SCOPE-013",
    standardVersions: ["2015", "2025"],
    category: "scope",
    severity: "review",
    source: {
      clause: "9.2.1.2",
      priorClause: "10.1.1",
      summary: "方括号数字在数学、数据表格等场景中可能不是文献引用。",
      status: OFFICIAL_2025,
    },
    explanation:
      "以下方括号数字标记存在歧义（如位于表格短单元格、紧邻数学符号等），已排除在确定性检查之外，请人工复核。",
    check: (ctx) => {
      const drafts: IssueDraft[] = [];
      for (const c of ctx.citations) {
        if (!c.detection.needsReview) continue;
        drafts.push({
          ruleId: "RR-SCOPE-013",
          category: "scope",
          severity: "review",
          messageKey: "issue.ambiguousMarker",
          messageParams: { raw: c.raw, signals: c.detection.signals.join(", ") },
          detail: `标记 ${c.raw} 疑似文献引用但存在歧义（信号：${c.detection.signals.join("、")}），未计入确定性检查。`,
          suggestion: "确认该标记是否为文献引用；若是，请调整书写形式。",
          anchors: [c.anchor],
          source: {
            clause: clauseFor(ctx.version, "9.2.1.2", "10.1.1"),
            summary: "方括号数字需结合上下文判断是否为文献引用。",
            status: ctx.version === "2025" ? OFFICIAL_2025 : SECONDARY_2015,
          },
          confidence: "medium",
          requiresManualCheck: true,
          relatedIds: [c.id],
        });
      }
      return drafts;
    },
    testCases: [
      {
        name: "ambiguous marker surfaced for review",
        input: {
          citations: [
            { id: "c1", raw: "[1,2]", numbers: [1, 2], detection: { confidence: "low", signals: ["cell-mostly-bracket"], needsReview: true } },
          ],
        },
        expect: { issueCount: 1, severity: "review" },
      },
    ],
  },
];
