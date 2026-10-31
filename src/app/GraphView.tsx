/**
 * Interactive citation–reference graph (custom SVG).
 *
 * Layout: citations on the left in appearance order, references on the right
 * in index order; one edge per (citation, number) relation. Nodes and edges
 * derive entirely from the analysis result — no static demo data.
 */
import { useMemo, useState } from "react";
import { useApp } from "./AppContext";
import type { AnalysisResult, Citation, ReferenceEntry } from "../core/types";

interface GraphProps {
  result: AnalysisResult;
  onLocateCitation: (c: Citation) => void;
  onLocateReference: (r: ReferenceEntry) => void;
}

const NODE_H = 26;
const GAP = 6;
const COL_L_X = 10;
const COL_R_X = 296;
const WIDTH = 412;

export default function GraphView({ result, onLocateCitation, onLocateReference }: GraphProps): React.ReactNode {
  const { tr } = useApp();
  const [selected, setSelected] = useState<{ type: "cit" | "ref"; id: string } | null>(null);
  const [query, setQuery] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(false);

  const missingNumbers = useMemo(
    () => new Set(result.relations.filter((r) => r.missing).map((r) => r.number)),
    [result.relations]
  );
  const refIssueCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of result.issues) {
      if (i.severity === "info") continue;
      for (const id of i.relatedIds) if (id.startsWith("ref-")) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [result.issues]);

  const citations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return result.citations.filter((c) => {
      if (issuesOnly && !c.detection.needsReview && !c.numbers.some((n) => missingNumbers.has(n))) return false;
      if (!q) return true;
      return (
        c.raw.toLowerCase().includes(q) ||
        String(c.anchor.blockIndex).includes(q) ||
        c.contextBefore.toLowerCase().includes(q)
      );
    });
  }, [result.citations, query, issuesOnly, missingNumbers]);

  const references = useMemo(() => {
    const q = query.trim().toLowerCase();
    return result.references.filter((r) => {
      if (issuesOnly && !refIssueCounts.get(r.id)) return false;
      if (!q) return true;
      return String(r.index).includes(q) || r.raw.toLowerCase().includes(q);
    });
  }, [result.references, query, issuesOnly, refIssueCounts]);

  const leftY = (i: number) => 20 + i * (NODE_H + GAP);
  const rightY = (i: number) => 20 + i * (NODE_H + GAP);
  const height = Math.max(leftY(Math.max(0, citations.length - 1)) + NODE_H + 20, rightY(Math.max(0, references.length - 1)) + NODE_H + 20, 240);

  const refById = useMemo(() => new Map(result.references.map((r) => [r.id, r])), [result.references]);
  const citById = useMemo(() => new Map(result.citations.map((c) => [c.id, c])), [result.citations]);

  const relationVisible = (cit: Citation, number: number): boolean => {
    const ref = result.references.find((r) => r.index === number);
    if (selected === null) return true;
    if (selected.type === "cit") return cit.id === selected.id;
    return ref?.id === selected.id;
  };

  const connectedIds = useMemo(() => {
    if (!selected) return null;
    if (selected.type === "cit") {
      const c = citById.get(selected.id);
      if (!c) return null;
      const refs = result.references.filter((r) => c.numbers.includes(r.index)).map((r) => r.id);
      return { cit: new Set([selected.id]), ref: new Set(refs) };
    }
    const r = refById.get(selected.id);
    if (!r) return null;
    const cits = result.citations.filter((c) => c.numbers.includes(r.index)).map((c) => c.id);
    return { cit: new Set(cits), ref: new Set([selected.id]) };
  }, [selected, citById, refById, result.citations, result.references]);

  const dimNode = (kind: "cit" | "ref", id: string): boolean =>
    connectedIds !== null && !connectedIds[kind].has(id);

  const clickNode = (type: "cit" | "ref", id: string): void => {
    if (selected && selected.type === type && selected.id === id) {
      setSelected(null);
      return;
    }
    setSelected({ type, id });
    if (type === "cit") {
      const c = citById.get(id);
      if (c) onLocateCitation(c);
    } else {
      const r = refById.get(id);
      if (r) onLocateReference(r);
    }
  };

  return (
    <div className="rr-graph">
      <div className="rr-graph__toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("graph.searchPlaceholder")}
          aria-label={tr("graph.searchPlaceholder")}
        />
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} />
          {tr("graph.filterIssues")}
        </label>
        <span className="rr-graph__hint">{tr("graph.clickHint")}</span>
      </div>
      {citations.length === 0 && references.length === 0 ? (
        <div className="rr-empty">{tr("graph.empty")}</div>
      ) : (
        <div className="rr-graph__canvas">
          <svg
            viewBox={`0 0 ${WIDTH} ${height}`}
            style={{ width: "100%", height: "auto", display: "block", minHeight: 180 }}
            role="img"
            aria-label={tr("graph.title")}
          >
            {/* column headers */}
            <text x={COL_L_X} y={12} fontSize="11" fill="var(--rr-text-muted)">
              {tr("graph.citations")}
            </text>
            <text x={COL_R_X} y={12} fontSize="11" fill="var(--rr-text-muted)">
              {tr("graph.references")}
            </text>
            {/* edges */}
            {result.relations.map((rel, i) => {
              const ci = citations.findIndex((c) => c.id === rel.citationId);
              if (ci === -1) return null;
              const ri = references.findIndex((r) => r.index === rel.number);
              const cit = citations[ci]!;
              const active =
                selected !== null &&
                ((selected.type === "cit" && selected.id === rel.citationId) ||
                  (selected.type === "ref" && refById.get(selected.id)?.index === rel.number));
              if (!relationVisible(cit, rel.number) && !active) return null;
              if (ri === -1) {
                // missing edge: to a placeholder on the right
                const y1 = leftY(ci) + NODE_H / 2;
                return (
                  <line
                    key={`m${i}`}
                    className={`rr-gedge rr-gedge--missing${active ? " rr-gedge--active" : ""}`}
                    x1={COL_L_X + 100}
                    y1={y1}
                    x2={COL_R_X - 16}
                    y2={y1}
                  />
                );
              }
              const y1 = leftY(ci) + NODE_H / 2;
              const y2 = rightY(ri) + NODE_H / 2;
              const mx = (COL_L_X + 100 + COL_R_X - 16) / 2;
              return (
                <path
                  key={rel.citationId + rel.number + i}
                  className={`rr-gedge${active ? " rr-gedge--active" : ""}`}
                  d={`M ${COL_L_X + 100} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${COL_R_X - 16} ${y2}`}
                />
              );
            })}
            {/* citation nodes */}
            {citations.map((c, i) => {
              const missing = c.numbers.some((n) => missingNumbers.has(n));
              const dim = dimNode("cit", c.id);
              return (
                <g
                  key={c.id}
                  className={`rr-gnode${dim ? " rr-gnode--dim" : ""}`}
                  onClick={() => clickNode("cit", c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") clickNode("cit", c.id);
                  }}
                  aria-label={`citation ${c.raw}`}
                >
                  <rect
                    x={COL_L_X}
                    y={leftY(i)}
                    width={100}
                    height={NODE_H}
                    rx={6}
                    fill={missing ? "var(--rr-danger-soft)" : c.detection.needsReview ? "var(--rr-review-soft)" : "var(--rr-primary-soft)"}
                    stroke={missing ? "var(--rr-danger)" : "transparent"}
                  />
                  <text x={COL_L_X + 8} y={leftY(i) + 17} fontSize="10.5" fill="var(--rr-text)">
                    {c.raw.length > 8 ? c.raw.slice(0, 7) + "…" : c.raw}
                  </text>
                </g>
              );
            })}
            {/* reference nodes */}
            {references.map((r, i) => {
              const dim = dimNode("ref", r.id);
              const hasIssue = (refIssueCounts.get(r.id) ?? 0) > 0;
              const t = r.fields.title ?? r.raw;
              const label = `[${r.index}] ${t.slice(0, 6)}${t.length > 6 ? "…" : ""}`;
              return (
                <g
                  key={r.id}
                  className={`rr-gnode${dim ? " rr-gnode--dim" : ""}`}
                  onClick={() => clickNode("ref", r.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") clickNode("ref", r.id);
                  }}
                  aria-label={`reference ${r.index}`}
                >
                  <rect
                    x={COL_R_X}
                    y={rightY(i)}
                    width={112}
                    height={NODE_H}
                    rx={6}
                    fill={hasIssue ? "var(--rr-warn-soft)" : "var(--rr-bg-inset)"}
                    stroke={hasIssue ? "var(--rr-warn)" : "transparent"}
                  />
                  <text x={COL_R_X + 8} y={rightY(i) + 17} fontSize="10.5" fill="var(--rr-text)">
                    {label}
                  </text>
                </g>
              );
            })}
            {/* missing placeholders */}
            {references.length >= 0 &&
              citations.map((c, i) =>
                c.numbers
                  .filter((n) => missingNumbers.has(n))
                  .map((n) => {
                    const y = leftY(i) + NODE_H / 2 - 8;
                    return (
                      <text key={`${c.id}-miss-${n}`} x={COL_R_X + 8} y={y + 8} fontSize="10.5" fill="var(--rr-danger)">
                        {`[${n}] ${tr("graph.missing")}`}
                      </text>
                    );
                  })
              )}
          </svg>
        </div>
      )}
    </div>
  );
}
