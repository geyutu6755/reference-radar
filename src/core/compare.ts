/**
 * Simple, honest comparison between two analysis runs (V1.2).
 *
 * Matching key: ruleId + exact detail text. Details are deterministic
 * message strings, so equal signatures mean the same finding; anchors may
 * shift between runs and are deliberately excluded from matching.
 *
 * This is an in-memory, single-session comparison. Nothing is persisted.
 */
import type { AnalysisResult, Issue } from "./types";

export interface RunComparison {
  /** Findings present in the previous run but gone from the new one. */
  resolved: Issue[];
  /** Findings present in the new run but absent before. */
  introduced: Issue[];
  /** Findings present in both runs. */
  persistent: Issue[];
  /** True when the two runs used different standard versions (comparing across versions is misleading). */
  versionMismatch: boolean;
}

const signature = (i: Issue): string => `${i.ruleId}|${i.detail}`;

export function compareRuns(previous: AnalysisResult, current: AnalysisResult): RunComparison {
  const prev = new Map(previous.issues.map((i) => [signature(i), i]));
  const curr = new Map(current.issues.map((i) => [signature(i), i]));

  const resolved: Issue[] = [];
  const persistent: Issue[] = [];
  for (const [sig, issue] of prev) {
    if (curr.has(sig)) persistent.push(issue);
    else resolved.push(issue);
  }
  const introduced = [...curr.values()].filter((i) => !prev.has(signature(i)));

  return {
    resolved,
    introduced,
    persistent,
    versionMismatch: previous.version !== current.version,
  };
}

export function comparisonSummary(c: RunComparison): string {
  const parts = [
    `已消失 ${c.resolved.length}`,
    `新出现 ${c.introduced.length}`,
    `仍然存在 ${c.persistent.length}`,
  ];
  if (c.versionMismatch) parts.push("⚠ 两次检查使用了不同标准版本，比较仅供参考");
  return parts.join(" · ");
}
