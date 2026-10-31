# Changelog

All notable changes are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [1.0.0] — 2026-11-01

First public release.

### Added

- DOCX (.docx/OOXML) import with local-only processing: safe unzip
  (size/ratio/path-traversal guards), structural parsing of paragraphs, runs,
  tables, footnotes/endnotes, Word field codes (Zotero/Mendeley/EndNote
  detection by displayed text), tracked revisions, hidden text and math
  placeholders, and Word auto-numbering rendering.
- Numeric citation extraction ([1], [1,2], [1-3], [1，3—5], full-width
  variants) with range expansion and structural disambiguation (headings,
  reference region, math adjacency, table cells, superscripts, zero numbers).
- Reference-list detection (heading + entry evidence, unheaded fallback) and
  entry parsing with bibliographic fields and confidence levels.
- GB/T 7714 rule engine with per-version (2015/2025) rule sets and verified
  source clauses: missing references, duplicate numbers, numbering gaps,
  first-citation order, list order, inverted/degenerate ranges, duplicate and
  near-duplicate entries, version-specific type-code validation, missing type
  identifier review, uncited-entry hints, missing-list and ambiguous-marker
  scoping. Every rule ships with executable test cases.
- Interactive SVG citation–reference graph with missing-link highlighting,
  focus, search and issues-only filter; accessible list views alongside.
- Analysis workbench: structure navigation, anchored document preview with
  citation highlighting, findings with clause basis and verification status,
  analysis-scope disclosure.
- Standalone HTML report and real PDF download (pdf-lib + Noto Sans CJK SC
  subset font, selectable CJK text).
- PWA: installable, offline-capable (verified), update prompt; service worker
  caches static assets only.
- zh-CN / English interface, light/dark themes, keyboard operability.
- Test suite: 117 unit/golden/hostile/perf tests plus Playwright E2E in
  Chromium, Firefox and WebKit; 18 hand-annotated golden samples.
- GitHub Actions CI and GitHub Pages deploy

  Chromium, Firefox and WebKit; 18 hand-annotated golden samples.
- GitHub Actions CI and GitHub Pages deployment.
