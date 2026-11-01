import { useCallback, useMemo, useRef, useState } from "react";
import { useApp } from "./AppContext";
import type { AnalysisResult, Citation, Issue, ReferenceEntry, StandardVersion } from "../core/types";
import DocumentPreview from "./DocumentPreview";
import IssuesPanel from "./IssuesPanel";
import ScopePanel from "./ScopePanel";
import GraphView from "./GraphView";
import { analyze } from "./worker-client";
import { errorToKey } from "./use-analysis";
import { downloadHtmlReport } from "./report-html";
import { RadarLogo } from "./icons";

interface WorkbenchProps {
  result: AnalysisResult;
  fileName: string;
  /** Original DOCX bytes (kept in memory only, never persisted) for re-analysis. */
  sourceBytes?: Uint8Array;
  onHome: () => void;
  onResult: (r: AnalysisResult, fileName: string) => void;
}

type RightTab = "issues" | "graph" | "scope";

export default function Workbench({ result, fileName, sourceBytes, onHome, onResult }: WorkbenchProps): React.ReactNode {
  const { tr, locale, setLocale, theme, toggleTheme } = useApp();
  const [tab, setTab] = useState<RightTab>("issues");
  const [filter, setFilter] = useState<Issue["severity"] | "all">("all");
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [version, setVersion] = useState<StandardVersion>(result.version);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<ReturnType<typeof errorToKey> | null>(null);
  const blockEls = useRef(new Map<number, HTMLElement>());
  const flashTimer = useRef<number | undefined>(undefined);

  const scrollToBlock = useCallback((index: number) => {
    setActiveBlockIndex(index);
    requestAnimationFrame(() => {
      const el = blockEls.current.get(index);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setActiveBlockIndex(null), 1800);
    });
  }, []);

  const blockRefs = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      if (el) blockEls.current.set(index, el);
      else blockEls.current.delete(index);
    },
    []
  );

  const onIssueClick = useCallback(
    (issue: Issue) => {
      setActiveIssue(issue);
      const anchor = issue.anchors[0];
      if (anchor) scrollToBlock(anchor.blockIndex);
    },
    [scrollToBlock]
  );

  const onCitationClick = useCallback(
    (c: Citation) => {
      setActiveCitationId((prev) => (prev === c.id ? null : c.id));
      setActiveIssue(null);
      scrollToBlock(c.anchor.blockIndex);
    },
    [scrollToBlock]
  );

  const onLocateReference = useCallback(
    (r: ReferenceEntry) => {
      scrollToBlock(r.anchor.blockIndex);
    },
    [scrollToBlock]
  );


  const exportHtml = useCallback(() => {
    try {
      downloadHtmlReport(result, fileName, locale);
    } catch (e) {
      setErrorKey({ key: "error.generic", params: { message: (e as Error).message } });
    }
  }, [result, fileName, locale]);

  const headingBlocks = useMemo(
    () => result.blocks.filter((b) => b.kind === "heading" && b.headingLevel !== undefined && b.headingLevel <= 3),
    [result.blocks]
  );

  const citationsByBlock = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of result.citations) {
      m.set(c.anchor.blockIndex, (m.get(c.anchor.blockIndex) ?? 0) + 1);
    }
    return m;
  }, [result.citations]);

  const versionChanged = version !== result.version;

  return (
    <div className="rr-wb">
      <header className="rr-wb__top">
        <button className="rr-btn rr-btn--ghost rr-btn--sm" onClick={onHome} aria-label={tr("workbench.newAnalysis")}>
          ← {tr("workbench.newAnalysis")}
        </button>
        <RadarLogo width={22} height={22} />
        <span className="rr-wb__file" title={fileName}>
          {fileName}
        </span>
        <div className="rr-wb__stats" aria-label="statistics">
          <span className="rr-stat">
            <b>{result.stats.citationMarkerCount}</b> {tr("workbench.stats.citations")}
          </span>
          <span className="rr-stat">
            <b>{result.stats.referenceCount}</b> {tr("workbench.stats.references")}
          </span>
          <span className="rr-stat" style={{ color: result.stats.errorCount > 0 ? "var(--rr-danger)" : undefined }}>
            <b>{result.stats.errorCount}</b> {tr("workbench.stats.errors")}
          </span>
          <span className="rr-stat" style={{ color: result.stats.warningCount > 0 ? "var(--rr-warn)" : undefined }}>
            <b>{result.stats.warningCount}</b> {tr("workbench.stats.warnings")}
          </span>
          <span className="rr-stat" style={{ color: result.stats.reviewCount > 0 ? "var(--rr-review)" : undefined }}>
            <b>{result.stats.reviewCount}</b> {tr("workbench.stats.reviews")}
          </span>
        </div>
        <div className="rr-wb__actions">
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            {tr("workbench.versionLabel")}
            <select
              className="rr-select"
              value={version}
              onChange={(e) => setVersion(e.target.value as StandardVersion)}
              aria-label={tr("workbench.versionLabel")}
            >
              <option value="2025">GB/T 7714—2025（现行）</option>
              <option value="2015">GB/T 7714—2015</option>
            </select>
          </label>
          {versionChanged && (
            <button
              className="rr-btn rr-btn--primary rr-btn--sm"
              disabled={reanalyzing || !sourceBytes}
              title={!sourceBytes ? (locale === "zh-CN" ? "粘贴文本无法切换版本重跑；请重新上传 DOCX" : "Pasted text cannot be re-analyzed as DOCX") : undefined}
              onClick={async () => {
                setReanalyzing(true);
                setErrorKey(null);
                try {
                  const r = await analyze({ kind: "docx", bytes: sourceBytes, fileName, version });
                  onResult(r, fileName);
                } catch (e) {
                  setErrorKey(errorToKey(e));
                } finally {
                  setReanalyzing(false);
                }
              }}
            >
              {reanalyzing ? tr("workbench.analyzing") : tr("workbench.analyze")}
            </button>
          )}
          <button className="rr-btn rr-btn--sm" onClick={exportHtml}>
            {tr("workbench.exportHtml")}
          </button>
          <button
            className="rr-btn rr-btn--sm"
            disabled={pdfBusy}
            title={locale === "zh-CN" ? "首次导出需加载中文字体（约 10 MB），请稍候" : "First export loads the CJK font (~10 MB)"}
            onClick={async () => {
              setPdfBusy(true);
              setErrorKey(null);
              try {
                const m = await import("./report-pdf");
                await m.exportPdfReport(result, fileName, locale);
              } catch (e) {
                setErrorKey({ key: "error.generic", params: { message: (e as Error).message } });
              } finally {
                setPdfBusy(false);
              }
            }}
          >
            {pdfBusy ? (locale === "zh-CN" ? "正在生成 PDF…" : "Generating PDF…") : tr("workbench.exportPdf")}
          </button>
          <button className="rr-btn rr-btn--ghost rr-btn--sm" onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")} aria-label="language">
            {locale === "zh-CN" ? "EN" : "中文"}
          </button>
          <button className="rr-btn rr-btn--ghost rr-btn--sm" onClick={toggleTheme} aria-label="theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      {errorKey && (
        <div className="rr-alert rr-alert--error" role="alert">
          {tr(errorKey.key, errorKey.params)}
        </div>
      )}

      <div className="rr-wb__body">
        <aside className="rr-wb__pane rr-wb__pane--left" aria-label={tr("workbench.structure")}>
          <h2 className="rr-pane-title">{tr("workbench.structure")}</h2>
          <nav>
            {headingBlocks.length === 0 && <div className="rr-empty">—</div>}
            {headingBlocks.map((b) => (
              <button
                key={b.id}
                className={`rr-nav-item rr-nav-item--h${Math.min(3, b.headingLevel ?? 1)}${activeBlockIndex === b.blockIndex ? " rr-nav-item--active" : ""}`}
                onClick={() => scrollToBlock(b.blockIndex)}
                title={b.text}
              >
                {b.text || "(空标题)"}
                {citationsByBlock.get(b.blockIndex) ? (
                  <span className="rr-cite-dots">[{citationsByBlock.get(b.blockIndex)}]</span>
                ) : null}
              </button>
            ))}
          </nav>
        </aside>

        <main className="rr-wb__pane rr-wb__pane--center" aria-label={tr("workbench.preview")}>
          <DocumentPreview
            result={result}
            activeBlockIndex={activeBlockIndex}
            activeCitationId={activeCitationId}
            onCitationClick={onCitationClick}
            blockRefs={blockRefs}
          />
        </main>

        <aside className="rr-wb__pane rr-wb__pane--right" aria-label={tr("workbench.issues")}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["issues", "graph", "scope"] as RightTab[]).map((tb) => (
              <button
                key={tb}
                role="tab"
                aria-selected={tab === tb}
                className={`rr-chip${tab === tb ? " rr-chip--active" : ""}`}
                onClick={() => setTab(tb)}
              >
                {tr(`workbench.tab.${tb}`)}
              </button>
            ))}
          </div>
          {tab === "issues" && (
            <IssuesPanel
              result={result}
              filter={filter}
              setFilter={setFilter}
              activeIssueId={activeIssue?.id ?? null}
              onIssueClick={onIssueClick}
            />
          )}
          {tab === "graph" && (
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
              <GraphView result={result} onLocateCitation={onCitationClick} onLocateReference={onLocateReference} />
            </div>
          )}
          {tab === "scope" && <ScopePanel result={result} />}
        </aside>
      </div>
    </div>
  );
}
