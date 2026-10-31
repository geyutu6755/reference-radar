import { useMemo } from "react";
import type { AnalysisResult, Citation, DocBlock } from "../core/types";

interface DocPreviewProps {
  result: AnalysisResult;
  activeBlockIndex: number | null;
  activeCitationId: string | null;
  onCitationClick: (c: Citation) => void;
  blockRefs: (index: number) => (el: HTMLElement | null) => void;
}

interface Piece {
  text: string;
  cite?: Citation;
}

/** Split block text into plain pieces and citation-highlight pieces. */
function piecesForBlock(block: DocBlock, citations: Citation[]): Piece[] {
  const marks = citations
    .filter((c) => c.anchor.paragraphId === block.id)
    .sort((a, b) => a.anchor.charStart - b.anchor.charStart);
  if (marks.length === 0) return [{ text: block.text }];
  const pieces: Piece[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.anchor.charStart > cursor) {
      pieces.push({ text: block.text.slice(cursor, m.anchor.charStart) });
    }
    pieces.push({ text: block.text.slice(m.anchor.charStart, m.anchor.charEnd), cite: m });
    cursor = m.anchor.charEnd;
  }
  if (cursor < block.text.length) pieces.push({ text: block.text.slice(cursor) });
  return pieces;
}

interface Row {
  key: string;
  blocks: DocBlock[];
}

/** Group consecutive table-cell blocks of the same row for row-like display. */
function groupRows(blocks: DocBlock[]): Array<{ kind: "row"; row: Row } | { kind: "block"; block: DocBlock }> {
  const out: Array<{ kind: "row"; row: Row } | { kind: "block"; block: DocBlock }> = [];
  let current: Row | null = null;
  for (const b of blocks) {
    if (b.containerKind === "table-cell") {
      // containerId: tblN:rR:cC
      const rowKey = b.containerId.split(":").slice(0, 2).join(":");
      if (!current || current.key !== rowKey) {
        current = { key: rowKey, blocks: [b] };
        out.push({ kind: "row", row: current });
      } else {
        current.blocks.push(b);
      }
    } else {
      current = null;
      out.push({ kind: "block", block: b });
    }
  }
  return out;
}

export default function DocumentPreview(props: DocPreviewProps): React.ReactNode {
  const { result, activeBlockIndex, activeCitationId, onCitationClick, blockRefs } = props;
  const missingNumbers = useMemo(
    () => new Set(result.relations.filter((r) => r.missing).map((r) => r.number)),
    [result.relations]
  );
  const grouped = useMemo(() => groupRows(result.blocks), [result.blocks]);

  const renderPieces = (b: DocBlock) => {
    const pieces = piecesForBlock(b, result.citations);
    return pieces.map((p, i) =>
      p.cite ? (
        <button
          key={i}
          className={[
            "rr-cite",
            p.cite.detection.needsReview ? "rr-cite--review" : "",
            p.cite.numbers.some((n) => missingNumbers.has(n)) ? "rr-cite--missing" : "",
            activeCitationId === p.cite.id ? "rr-cite--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onCitationClick(p.cite!)}
          title={p.cite.raw}
          aria-label={`citation ${p.cite.raw}`}
        >
          {p.text}
        </button>
      ) : (
        <span key={i}>{p.text}</span>
      )
    );
  };

  return (
    <div className="rr-doc" role="document" aria-label="document preview">
      {grouped.map((g, gi) => {
        if (g.kind === "block") {
          const b = g.block;
          const headingKey = b.headingLevel ? `h${Math.min(3, b.headingLevel)}` : null;
          const flash = activeBlockIndex === b.blockIndex;
          return (
            <p
              key={b.id}
              ref={blockRefs(b.blockIndex)}
              id={`blk-${b.blockIndex}`}
              className={[
                "rr-doc__block",
                headingKey ? `rr-doc__block--${headingKey}` : "",
                b.containerKind === "footnote" || b.containerKind === "endnote" ? "rr-doc__block--note" : "",
                b.numberingText ? "rr-doc__block--num" : "",
                flash ? "rr-doc__block--flash" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-number={b.numberingText ?? undefined}
            >
              {renderPieces(b)}
            </p>
          );
        }
        const row = g.row;
        const prevIsRow = gi > 0 && grouped[gi - 1]!.kind === "row";
        const nextIsRow = gi + 1 < grouped.length && grouped[gi + 1]!.kind === "row";
        const flash = row.blocks.some((b) => activeBlockIndex === b.blockIndex);
        return (
          <div
            key={row.key}
            ref={(el) => row.blocks.forEach((b) => blockRefs(b.blockIndex)(el))}
            className={[
              "rr-doc__row",
              prevIsRow ? "" : "rr-doc__row--first",
              nextIsRow ? "" : "rr-doc__row--last",
              flash ? "rr-doc__block--flash" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="table"
            aria-label="table row"
          >
            {row.blocks.map((b) => (
              <div key={b.id} className="rr-doc__cell" id={`blk-${b.blockIndex}`}>
                {renderPieces(b)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
