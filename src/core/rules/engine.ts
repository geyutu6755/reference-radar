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

export function runRules(ctx: RuleContext): Issue[] {
  const issues: Issue[] = [];
  for (const rule of RULES) {
    if (!rule.standardVersions.includes(ctx.version)) continue;
    if (rule.source.status === "unverified") continue;
    let drafts: IssueDraft[];
    try {
      drafts = rule.check(ctx);
    } catch {
      continue; // a faulty rule must never break the whole analysis
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
