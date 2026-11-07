import { useState } from "react";
import { comparisonSummary, type RunComparison } from "../core/compare";

/** Compact, dismissible comparison of the current run against the previous one. */
export default function ComparisonCard({ comparison }: { comparison: RunComparison }): React.ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <div className="rr-compare" role="status">
      <button
        type="button"
        className="rr-compare__summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="rr-compare__title">与上一次检查比较</span>
        <span className="rr-compare__counts">{comparisonSummary(comparison)}</span>
        <span className="rr-compare__toggle" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="rr-compare__body">
          <div className="rr-compare__section">
            <b className="rr-compare__resolved">已消失 {comparison.resolved.length}</b>
            {comparison.resolved.slice(0, 8).map((i) => (
              <div key={i.id} className="rr-compare__line">{i.detail}</div>
            ))}
          </div>
          <div className="rr-compare__section">
            <b className="rr-compare__introduced">新出现 {comparison.introduced.length}</b>
            {comparison.introduced.slice(0, 8).map((i) => (
              <div key={i.id} className="rr-compare__line">{i.detail}</div>
            ))}
          </div>
          <div className="rr-compare__section">
            <b className="rr-compare__persistent">仍然存在 {comparison.persistent.length}</b>
            {comparison.persistent.slice(0, 8).map((i) => (
              <div key={i.id} className="rr-compare__line">{i.detail}</div>
            ))}
          </div>
          <div className="rr-compare__note">匹配依据：规则编号与结论文本完全一致；定位可能移动。仅本次会话内存中比较。</div>
        </div>
      )}
    </div>
  );
}
