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

/** Draft issue: engine assigns id + standardVersion. */
type IssueDraft = Omit<Issue, "id" | "standardVersion">;

const OFFICIAL_2025 = "verified-official" as const;
const SECONDARY_2015 = "verified-secondary" as const;

function clauseFor(version: "2015" | "2025", c2025: string, c2015: string): string {
  return version === "2025" ? c2025 : c2015;
}

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
          } else if (similarity(a.key, b.key) > 0.9) {
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
