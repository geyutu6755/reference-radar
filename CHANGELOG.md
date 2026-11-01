# Changelog

All notable changes are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [1.0.2] — 2026-11-01

Real-usage validation & test-reliability release. **No application-code
changes** — the deployed site is identical to the v1.0.1 app build (service
worker version intentionally unchanged to avoid a pointless re-download);
the release ships hardened tests, an independent real-document study and the
public-beta infrastructure. v1.0.0/v1.0.1 tags untouched.

### Added

- **Strengthened independent live test** (`scripts/live-test.mjs`): page
  errors now fail the run; the clean sample asserts exact zero-issue stats;
  the error sample asserts exact ruleIds, detail text, clause basis, locate
  flash and graph missing-relation data — online AND offline; HTML/PDF export
  contents verified (ruleIds, %PDF magic); a negative canary proves the
  assertion harness throws on wrong expectations. Supersedes the
  false-positive-prone v1.0.1 live script.
- **Negative E2E trial**: analysis-worker sabotage — the app must fail loudly
  with an error alert (or produce a real main-thread analysis), never a silent
  fake success. HTML report download now content-checked in E2E.
- **Real-document compatibility study** (`docs/real-docx-validation.md`): two
  real university thesis templates (北航 2026-2027, 人大) plus the GB/T
  7714—2025 standard DOCX, hand-annotated. Measured on real documents:
  marker precision/recall **1.000**, zero deterministic false positives,
  compressed/full-width punctuation, 增刊, 析出文献, PP/DS codes, empty
  template slots and broken URLs all handled per annotation. Sample count and
  acquisition limits recorded honestly (3 real documents; most thesis DOCX
  circulate via non-programmatic channels).
- **Public-beta trial tasks** for 本科生/研究生/编辑 (5-minute checklists),
  desanitized-submission rules, privacy statement extension (`docs/feedback.md`).
- **V1.1 priority research** (`docs/v1.1-research.md`): demand evidence,
  feasibility, standard basis and competitor landscape; recommends P0
  journal-entry and e-resource format checks over author–year expansion.

### Verified

- Full gates: tsc strict, eslint, 147 tests, production build, Playwright E2E
  13 passed (Chromium/Firefox/WebKit), 0-vulnerability audit.

## [1.0.1] — 2026-11-01

Quality-acceptance and adoption-readiness release. No tag was moved; v1.0.0 remains available.

### Added

- **Independent external corpus**: 20 documents built by a separate generator
  (real-Word-shaped OOXML) with hand annotations written before running the
  engine; measured marker precision/recall **1.000** and **0 false
  positives / 0 misses** on deterministic findings, enforced as a permanent
  test gate (`docs/external-validation.md`, `corpus/`).
- **Rule RR-FMT-011**: page ranges must use the hyphen "-" (clause 6.2) —
  full-width "～" / "—" / en-dash ranges are flagged.
- **Rule RR-FMT-013**: online (/OL) entries require a cited date [YYYY-MM-DD]
  (clauses 7.6 / 8.11). Rule count: 12 → 14.
- New-user guide (`docs/user-guide.md`, zh/en), public-beta feedback plan
  (`docs/feedback.md`), usage-question issue template, GitHub Discussions,
  refreshed topics and Chinese SEO metadata.

### Fixed

- Near-duplicate reference detection threshold 0.9 → 0.85: same-author /
  same-issue pairs differing only in page numbers now surface as review items
  (regression-tested via corpus case C19).
- PDF export button now shows a busy state and a first-use font-load hint
  instead of appearing frozen during the ~10 MB CJK font fetch.
- Responsive defect: brand name wrapped vertically at 390px width; navigation
  now wraps and the English subtitle hides below 640px (verified with
  tablet/mobile screenshots).

### Verified

- Independent live-product test on a fresh browser profile: first visit,
  corpus DOCX upload, graph, HTML+PDF export, offline reload, **offline DOCX
  import + offline PDF export** — all pass with zero page errors.
- Full CI (typecheck/lint/143 tests/build/audit + Playwright E2E in
  Chromium/Firefox/WebKit) and Pages deployment green.

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
