# Changelog

All notable changes are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [1.1.1] — unreleased (fix branch `fix/v1.1.1-false-positives`)

Correctness release for the V1.1 entry-format work. **No new product features.**
An independent takeover review found that V1.1.0 shipped rules which could not
fire on a real `.docx`, and that two of them produced false positives — all with
a green 184-test suite. Root cause: rule unit tests inject parsed `fields`
directly, so they never exercise the extractor.

### Fixed (P0 — false positives and unreachable rules)

- **Field layer keeps what it was asked to police**: `pagesRaw` / `citedDateRaw`
  preserve the printed page separator and printed cited date next to the
  normalised values (`24～33`, `2025.1.15`).
- **RR-FMT-011 and RR-FMT-017 are reachable again.** Before this release neither
  could ever fire on a document: the separator was normalised away before the
  rule read it, and the date pattern only accepted values already in ISO form.
- **RR-FMT-013 contradiction removed**: an entry whose cited date is printed in
  a non-ISO form was reported as “cited date missing” with high confidence —
  the very class of false positive the V1.1 audit set out to eliminate. Presence
  is now judged on the printed value, and the format problem is reported once by
  RR-FMT-017.
- **RR-FMT-015 stopped flagging correct thesis entries.** It tested
  `publisher`/`place`, which the parser never assigned anywhere in the codebase,
  so every properly formatted `[D]` entry (“武汉: 武汉大学, 2022: 87.”) was
  reported as lacking its degree-granting unit. Publication info is now
  extracted positionally from the 表6 format, so institutions naming neither
  大学 nor 学院 are recognised too.
- **RR-FMT-018 stopped flagging the standard’s own examples.** The number pattern
  was anchored to the start of the entry and required digits right after the
  organisation code, so `IEC/IEEE 61636-1: 2021`, `IEEE P802.11ba/D8.0—2020` and
  `AIAA G-136—2022` (all printed in GB/T 7714—2025 itself) were reported as
  missing a standard number. The pattern is now unanchored and covers part
  numbers and group letters, and the finding asks for a manual check.

### Fixed (P1)

- **Copy corrected entry is honest.** Preview and clipboard are the same string
  by construction (literal split/join, so `$&`-style sequences in a document
  cannot expand); a span that occurs more than once, or resolves to no valid
  date, now shows an explicit refusal (`fixBlocked`) instead of a copy button
  that silently returns unchanged text.
- **DOCX decompression is bounded during inflation, not after.** The previous
  unpacker decompressed the whole archive first and checked sizes afterwards,
  and its comment claimed aborts that did not exist; central-directory
  declarations are attacker-controlled. Rewritten on fflate’s streaming `Unzip`
  fed in 64 KiB slices with per-entry and cumulative caps applied to bytes as
  they are produced. Only the seven parts the OOXML reader consumes are inflated
  at all, so images/fonts/themes can no longer exhaust memory.

### Fixed (P2)

- RR-FMT-014’s displayed basis now cites the table that governs each type
  (adds 8.11.3.1 表11 for 网页 and 8.14.2 表14 for 数据集) and honours 表14’s
  “电子资源必备” condition instead of assuming it.
- A rule that throws is no longer swallowed: the failure is reported through
  `parseWarnings` into the scope panel and both report formats.
- Service worker refuses to activate an incomplete precache, so a partially
  failed deploy can no longer evict the working offline cache.
- Reference lists that cannot be segmented (lost Word auto-numbering) stop
  merging into one entry and disclose it; publication year is no longer read
  from a standard number (“GB/T 7714—2025” → 2025, not 7714) or from a coverage
  span in a title; superscript `[1]` markers keep their strongest signal.
- Documentation corrected against the code: `limitations.md` (was still v1.0.0 /
  “12 rule families”), `testing.md` results, README offline-export claim, and a
  dated correction block in `real-docx-validation.md` for conclusions the V1.1
  and V1.1.1 audits overturned.

### Added (tests, not counts)

- `src/core/rules/reachability.test.ts` — permanent gate driving DOCX bytes
  through the whole pipeline for every RR-FMT rule (41 cases; 20 of them failed
  against V1.1.0 code).
- `src/core/docx/bounds.test.ts` — lying headers, stored entries, entry storms,
  traversal names, truncated streams, exact round-trip of a >1 MB part.
- Chromium E2E that reads the real clipboard and compares the whole corrected
  entry verbatim, including the refusal path.
- `src/core/rules/entry-requirements.ts` — the per-type element facts (element,
  necessity, clause, table) each rule depends on, committed so the audit no
  longer lives only in an unresearched local scan. The standard’s text is still
  not redistributed.

### Verified

- 239 unit tests / 0 failed · 14 passed + 4 deliberately skipped E2E across
  Chromium, Firefox and WebKit · typecheck 0 errors · lint 0 errors ·
  `pnpm audit` 0 vulnerabilities · external corpus and stress sample
  re-measured with no structural regression (marker P/R 1.000, 221 ms).



## [1.1.0] — 2026-11-01

Professional entry-format checking: the tool now helps writers find and FIX
common bibliographic problems, not just numbering consistency. Rule count
14 → 19, after a full per-type 必备性 audit against the official standard scan.

### Fixed (audit)

- **RR-FMT-013 rewritten**: cited-date applicability narrowed to 网站网页
  (表10), 数据集 (表14) and 预印本 (表15). The v1.0.1 rule falsely warned on
  journal/thesis/report/patent/standard /OL entries — the standard's own
  [J/OL] examples carry no cited date. Real-template annotations corrected.

### Added (rules, all grounded in the verified per-type tables)

- **RR-FMT-014**: 网站网页/预印本/数据集 entries require a URL.
- **RR-FMT-015**: [D] entries missing the degree-granting institution (必备)
  → review when parse confidence allows.
- **RR-FMT-016**: [J] entries without a publication year → review; article
  numbers (示例6) and online-first dates (示例7) are explicitly legitimate.
- **RR-FMT-017**: cited date not in YYYY-MM-DD format → warning **with a
  mechanical fix preview**.
- **RR-FMT-018**: [S] entries without a standard number → warning; the
  compressed "GB/T20090.16—2016" form is handled (caught by real templates).

### Added (product)

- **预览修改 / 复制建议**: issues with an unambiguous mechanical fix show a
  before/after preview and a one-click "copy corrected entry" — no missing
  information is ever invented; original DOCX is never modified.
- **Issue grouping** for long papers (grouped by rule with collapsible counts
  above 12 findings), verified on the 1402-block standard document.
- Real-derived redistributable regression fixtures (北航/人大 template entry
  lists) now run in CI; the local real-document study reports skipped files
  explicitly instead of silently passing.

### Verified

- 184 tests (recorded as “185 tests” when this section was written; 184 is what
  the release commit measures), incl. per-rule positive/negative/legal-exception
  cases and the real-derived fixtures, Playwright E2E, 0-vulnerability audit,
  long-document UX screenshots. **Corrected in 1.1.1:** two of the five “new
  rules” in this release could not fire on a real document, and one produced
  false positives — see the 1.1.1 Fixed section and
  [`docs/rule-coverage.md`](docs/rule-coverage.md).

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
