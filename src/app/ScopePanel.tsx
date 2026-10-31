import { useApp } from "./AppContext";
import type { AnalysisResult } from "../core/types";

export default function ScopePanel({ result }: { result: AnalysisResult }): React.ReactNode {
  const { tr } = useApp();
  const containerNames: Record<string, string> = {
    body: "正文段落 / Body paragraphs",
    "table-cell": "表格 / Tables",
    footnote: "脚注 / Footnotes",
    endnote: "尾注 / Endnotes",
    textbox: "文本框 / Text boxes",
    header: "页眉 / Headers",
    footer: "页脚 / Footers",
  };
  return (
    <div style={{ overflowY: "auto" }}>
      <h3 className="rr-pane-title">{tr("scope.analyzed")}</h3>
      <ul className="rr-scope-list">
        {result.scope.analyzedContainers.map((c) => (
          <li key={c}>{containerNames[c] ?? c}</li>
        ))}
        <li>
          {tr("workbench.stats.blocks")}: {result.stats.blockCount} · {tr("workbench.stats.citations")}:{" "}
          {result.stats.citationMarkerCount} · {tr("workbench.stats.references")}: {result.stats.referenceCount}
        </li>
        <li>
          {tr("workbench.versionLabel")}: GB/T 7714—{result.version === "2025" ? "2025（现行）" : "2015"}
        </li>
        {result.scope.referenceSectionTitle && <li>参考文献标题：{result.scope.referenceSectionTitle}</li>}
      </ul>
      <h3 className="rr-pane-title" style={{ marginTop: 16 }}>
        {tr("scope.excluded")}
      </h3>
      <ul className="rr-scope-list">
        {result.scope.excludedNotes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
      {result.parseWarnings.length > 0 && (
        <>
          <h3 className="rr-pane-title" style={{ marginTop: 16 }}>
            {tr("scope.warnings")}
          </h3>
          <ul className="rr-scope-list">
            {result.parseWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </>
      )}
      <h3 className="rr-pane-title" style={{ marginTop: 16 }}>
        规则覆盖 / Rule coverage
      </h3>
      <p style={{ fontSize: 12.5, color: "var(--rr-text-muted)" }}>
        本工具仅覆盖顺序编码制（数字上标/方括号编号）的部分可核查规则，不构成对 GB/T 7714
        全部条款的合规认证。详见项目 docs/rule-coverage.md。
        <br />
        This tool covers a subset of checkable rules of the numeric citation system only; it is not a
        full-standard compliance certification. See docs/rule-coverage.md.
      </p>
    </div>
  );
}
