/**
 * GB/T 7714 rule engine: registry + execution.
 *
 * Every rule is a self-contained definition with source clause, verification
 * status, applicability and test cases. The engine only runs rules whose
 * standardVersions include the selected version. Rules marked `unverified`
 * never run (no deterministic conclusions without verified sources).
 */
import type { Issue, RuleContext, RuleDefinition, Severity, StandardVersion } from "../types";
import { RULES } from "./definitions";

export type { RuleDefinition };

/** Issue draft returned by rule checks (engine assigns id/version). */
export type IssueDraft = Omit<Issue, "id" | "standardVersion">;

let issueSeq = 0;

/**
 * How a rule failure is disclosed. Used by every pipeline so the wording stays
 * identical wherever the user reads it (scope panel, HTML and PDF reports).
 */
export function ruleFailureWarning(ruleId: string, error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);
  return `规则 ${ruleId} 执行失败，该项检查未得出结论。/ Rule ${ruleId} failed to run, so no conclusion was drawn from it: ${reason}`;
}

export function runRules(
  ctx: RuleContext,
  onFailure?: (ruleId: string, error: unknown) => void
): Issue[] {
  const issues: Issue[] = [];
  for (const rule of RULES) {
    if (!rule.standardVersions.includes(ctx.version)) continue;
    if (rule.source.status === "unverified") continue;
    let drafts: IssueDraft[];
    try {
      drafts = rule.check(ctx);
    } catch (error) {
      // A faulty rule must not break the whole analysis — but silently
      // dropping its findings would report “clean” on a damaged basis, so the
      // failure is surfaced through the caller's warning channel (V1.1.1).
      onFailure?.(rule.ruleId, error);
      continue;
    }
    for (const d of drafts) {
      issues.push({ ...d, id: `iss-${issueSeq++}`, standardVersion: ctx.version });
    }
  }
  return issues;
}

/** All registered rules (for rule-coverage docs / UI transparency). */
export function allRules(): RuleDefinition[] {
  return RULES;
}

export function rulesForVersion(version: StandardVersion): RuleDefinition[] {
  return RULES.filter((r) => r.standardVersions.includes(version) && r.source.status !== "unverified");
}

export type { Severity };
