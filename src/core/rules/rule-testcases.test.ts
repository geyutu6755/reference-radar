/**
 * Meta-test: every rule's declared test cases must actually pass.
 * A rule test case that silently fails (or never runs) is treated as failure.
 */
import { describe, expect, it } from "vitest";
import { RULES } from "./definitions";
import { runRules } from "./engine";
import type { Citation, ReferenceEntry, Relation, RuleContext, RuleTestInput, StandardVersion } from "../types";

/** Fill defaults so rule test cases can declare partial inputs concisely. */
function normalizeCitation(c: Partial<Citation>, i: number): Citation {
  const raw = c.raw ?? `[${(c.numbers ?? [i + 1]).join(",")}]`;
  return {
    id: c.id ?? `tc-c${i}`,
    raw,
    numbers: c.numbers ?? [],
    segments: c.segments ?? [],
    anchor:
      c.anchor ??
      {
        containerId: "body",
        containerKind: "body",
        paragraphId: "body:p1",
        blockIndex: 1,
        charStart: 0,
        charEnd: raw.length,
        text: raw,
      },
    contextBefore: c.contextBefore ?? "",
    contextAfter: c.contextAfter ?? "",
    order: c.order ?? i,
    isFirstOccurrenceOf: c.isFirstOccurrenceOf ?? [],
    detection: c.detection ?? { confidence: "high", signals: [], needsReview: false },
  };
}

function normalizeReference(r: Partial<ReferenceEntry>, i: number): ReferenceEntry {
  const raw = r.raw ?? `文献${i + 1}`;
  return {
    id: r.id ?? `tc-r${i}`,
    index: r.index ?? i + 1,
    displayNumber: r.displayNumber ?? `[${r.index ?? i + 1}]`,
    numberingKind: r.numberingKind ?? "manual",
    raw,
    fields: r.fields ?? {},
    fieldsConfidence: r.fieldsConfidence ?? "high",
    anchor:
      r.anchor ??
      {
        containerId: "body",
        containerKind: "body",
        paragraphId: "body:p2",
        blockIndex: 2,
        charStart: 0,
        charEnd: raw.length,
        text: raw,
      },
    notes: r.notes ?? [],
  };
}

function ctxFor(version: "2015" | "2025", input: RuleTestInput): RuleContext {
  const opts = input.options ?? {};
  return {
    version,
    citations: (input.citations ?? []).map(normalizeCitation),
    references: (input.references ?? []).map(normalizeReference),
    relations: (input.relations ?? []) as Relation[],
    blocks: [],
    notes: [],
    scope: {
      analyzedContainers: ["body"],
      excludedNotes: [],
      referenceSectionDetected: (opts["referenceSectionDetected"] as boolean | undefined) ?? true,
    },
  };
}

describe("rule test cases", () => {
  for (const rule of RULES) {
    describe(rule.ruleId, () => {
      for (const tc of rule.testCases) {
        const targetVersions: StandardVersion[] = tc.version ? [tc.version] : rule.standardVersions;
        for (const version of targetVersions) {
          it(tc.name + (tc.version ? ` [${version}]` : ""), () => {
            const issues = runRules(ctxFor(version, tc.input)).filter((i) => i.ruleId === rule.ruleId);
          if (tc.expect.issueCount !== undefined) {
            expect(issues).toHaveLength(tc.expect.issueCount);
          } else {
            expect(issues.length).toBeGreaterThan(0);
          }
          if (tc.expect.severity !== undefined && issues.length > 0) {
            expect(issues.every((i) => i.severity === tc.expect.severity)).toBe(true);
          }
            for (const frag of tc.expect.detailIncludes ?? []) {
              expect(issues.some((i) => i.detail.includes(frag))).toBe(true);
            }
          });
        }
      }
    });
  }
});
