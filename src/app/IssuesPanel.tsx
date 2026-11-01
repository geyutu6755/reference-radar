import { useState } from "react";
import type { AnalysisResult, Issue, Severity } from "../core/types";
import { useApp } from "./AppContext";

/** Mechanical fix preview + copy. Never invents bibliographic content. */
function FixPreview({ issue }: { issue: Issue }): React.ReactNode {
  const { tr } = useApp();
  const [copied, setCopied] = useState(false);
  const fp = issue.fixPreview!;
  const anchorText = issue.anchors[0]?.text ?? "";
  const corrected = anchorText.replace(fp.find, fp.replace);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(corrected);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rr-fixpreview">
      <div className="rr-fixpreview__title">{tr("fix.previewTitle")}</div>
      <div className="rr-fixpreview__row">
        <span className="rr-fixpreview__label">{tr("fix.before")}</span>
        <code className="rr-fixpreview__before">{fp.find}</code>
      </div>
      <div className="rr-fixpreview__row">
        <span className="rr-fixpreview__label">{tr("fix.after")}</span>
        <code className="rr-fixpreview__after">{fp.replace}</code>
      </div>
      <div className="rr-fixpreview__actions">
        <button type="button" className="rr-btn rr-btn--sm" onClick={() => void copy()} disabled={copied}>
          {copied ? tr("fix.copied") : tr("fix.copy")}
        </button>
        <span className="rr-fixpreview__note">{tr("fix.noFabrication")}</span>
      </div>
    </div>
  );
}

interface IssuesPanelProps {
  result: AnalysisResult;
  filter: Severity | "all";
  setFilter: (f: Severity | "all") => void;
  activeIssueId: string | null;
  onIssueClick: (issue: Issue) => void;
}

const SEVERITIES: Array<Severity | "all"> = ["all", "error", "warning", "review", "info"];

export default function IssuesPanel(props: IssuesPanelProps): React.ReactNode {
  const { result, filter, setFilter, activeIssueId, onIssueClick } = props;
  const { tr, locale } = useApp();

  const counts: Record<string, number> = {
    all: result.issues.length,
    error: result.stats.errorCount,
    warning: result.stats.warningCount,
    review: result.stats.reviewCount,
    info: result.stats.infoCount,
  };
  const visible = filter === "all" ? result.issues : result.issues.filter((i) => i.severity === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div className="rr-issues-toolbar" role="tablist" aria-label={tr("workbench.issues")}>
        {SEVERITIES.map((s) => (
          <button
            key={s}
            className={`rr-chip${filter === s ? " rr-chip--active" : ""}`}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
          >
            {tr(`workbench.filter.${s}`)}
            <span style={{ opacity: 0.75, marginLeft: 4 }}>{counts[s]}</span>
          </button>
        ))}
      </div>
      <div style={{ overflowY: "auto", minHeight: 0 }}>
        {visible.length === 0 ? (
          <div className="rr-empty">{tr("workbench.noIssues")}</div>
        ) : (
          visible.map((issue) => (
            <div
              key={issue.id}
              className={`rr-issue${activeIssueId === issue.id ? " rr-issue--active" : ""}`}
              onClick={() => onIssueClick(issue)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onIssueClick(issue);
              }}
              role="button"
              tabIndex={0}
              aria-label={issue.detail}
            >
              <div className="rr-issue__head">
                <span className={`rr-badge rr-badge--${issue.severity}`}>
                  {tr(`workbench.filter.${issue.severity}`)}
                </span>
                <span className="rr-issue__rule">{issue.ruleId}</span>
                {issue.requiresManualCheck && (
                  <span className="rr-badge rr-badge--review" title={tr("workbench.manualCheck")}>
                    ✋
                  </span>
                )}
              </div>
              <p className="rr-issue__detail">{issue.detail}</p>
              {issue.anchors[0]?.text && <div className="rr-issue__quote">“{issue.anchors[0].text}”</div>}
              {issue.suggestion && (
                <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                  <b style={{ color: "var(--rr-ok)" }}>{tr("workbench.suggestion")}：</b>
                  {issue.suggestion}
                </div>
              )}
              {issue.fixPreview && <FixPreview issue={issue} />}
              <div className="rr-issue__basis">
                <span>
                  <b>{tr("workbench.ruleBasis")}</b> · GB/T 7714—{issue.standardVersion === "2025" ? "2025" : "2015"} 第{" "}
                  {issue.source.clause} 条
                  {issue.source.priorClause && issue.standardVersion === "2015" ? `（对应 2015 版 ${issue.source.priorClause}）` : ""}
                </span>
                <span style={{ opacity: 0.8 }}>
                  {issue.source.summary}
                </span>
                <span style={{ opacity: 0.7 }}>
                  {locale === "zh-CN"
                    ? issue.source.status === "verified-official"
                      ? "依据状态：已在官方标准文本中核验"
                      : "依据状态：已通过多个权威二手来源核验"
                    : issue.source.status === "verified-official"
                      ? "Verified against the official standard text"
                      : "Verified via multiple authoritative secondary sources"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
