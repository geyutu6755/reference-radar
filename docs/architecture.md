# Architecture

Reference Radar is a single-page browser application. All analysis happens
locally in the browser: documents are never uploaded to a server.

## Layers

```
src/
  core/                  pure TypeScript, no DOM/UI dependency, unit-testable
    types.ts             versioned intermediate data structures
    docx/                DOCX (OOXML) unpacking + structural parsing
    extract/             citation extraction from parsed blocks
    references/          reference-list detection + entry parsing
    rules/               GB/T 7714 rule engine (2015 / 2025 rule sets)
    graph/               citation–reference relation building
    report/              report data assembly
    pipeline.ts          end-to-end analysis orchestration
  app/                   React UI (workbench, home, graph, settings)
  i18n/                  zh-CN / en localization
  design/                CSS design system (tokens + components)
```

The `core` layer never imports from `app`. It is designed so the parser and
rule engine could be published as standalone npm packages later.

## Data flow

```
DOCX file (browser)
  → unzip (fflate, with hard size/decompression limits)
  → OOXML parse (fast-xml-parser, entities disabled)
  → DocBlock[] (paragraphs, table cells, footnotes, endnotes; anchors kept)
  → Citation[]  (bracket-number extraction with structural disambiguation)
  → ReferenceEntry[] (reference section detection + entry parsing)
  → Relation[]  (citation ↔ reference links)
  → Rule engine (version-selected GB/T 7714 rule set) → Issue[]
  → AnalysisResult → UI / graph / HTML+PDF reports
```

Heavy parsing and rule checking run inside a Web Worker so the UI stays
responsive.

## Key design decisions

| Decision | Choice | Rationale |
|---|---|---|
| DOCX unzip | `fflate` | small, fast, maintained; we enforce our own bomb guards |
| OOXML parsing | `fast-xml-parser` | pure JS, no external entity resolution |
| Citation graph | custom SVG React component | full control, small bundle, accessible list fallback |
| PDF export | `pdf-lib` + `@pdf-lib/fontkit` + bundled CJK font | real PDF file with selectable text, works offline |
| PWA | hand-written service worker + generated precache manifest | transparent caching, no runtime CDN |
| State | React built-ins | app state is small and local |

## Standard versioning

Rule definitions carry `standardVersions`, a `source` clause reference and a
verification status. Rules whose clause could not be verified in authoritative
material are disabled from producing deterministic conclusions. See
`docs/rule-coverage.md`.

## Security model

- Upload limit: 20 MB compressed, decompressed content capped per-file and in total.
- XML parsing with entity expansion disabled; no network fetches during analysis.
- All rendered content is escaped by React; report HTML is generated with escaping.
- Service worker caches only static app assets, never user documents.
