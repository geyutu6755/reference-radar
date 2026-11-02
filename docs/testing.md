# Testing Guide

## Test layers

| Layer | Command | What it covers |
|---|---|---|
| Unit + rules + golden + hostile + perf | `pnpm test` (Vitest) | parser, extractor, reference parsing, rule engine, 18 hand-annotated golden samples, 5 hostile inputs, stress performance |
| Rule reachability (V1.1.1) | `pnpm test` (`src/core/rules/reachability.test.ts`) | every RR-FMT rule driven from **DOCX bytes** through the real pipeline: correct entries must not fire, typical errors must, legal exceptions must not, uncertain cases must downgrade, and the clause/anchor shown must be the one that governs that type |
| Decompression bounds (V1.1.1) | `pnpm test` (`src/core/docx/bounds.test.ts`) | caps enforced on bytes produced, not on ZIP headers: lying sizes, stored entries, entry storms, traversal names, truncated streams, and an exact round-trip of a >1 MB part |
| E2E | `pnpm exec playwright test` | full user path in Chromium/Firefox/WebKit against the production build, incl. offline PWA, downloads, and clipboard-verified fix previews |
| Type/lint | `pnpm typecheck` / `pnpm lint` | strict TS, ESLint |
| Build | `pnpm build` | production bundle |

**Method note (V1.1.1):** rule unit tests inject `fields` objects directly, so a
rule can satisfy all of them while being unreachable from a real document — which
is how V1.1.0 shipped two dead rules and two false-positive rules with a green
suite. Unit cases are kept, but a rule is only considered working when the
reachability file proves it fires from bytes.

## Golden samples

`src/core/golden/samples.ts` builds 18 DOCX samples programmatically, each with
**hand-authored expectations written before running the pipeline** (missing
references, duplicate numbers, order violations, inverted ranges, repeated
citations, mixed markers, zh/en mix, run-split citations, table citations,
auto-numbered lists, footnotes/endnotes, Zotero fields, non-citation brackets,
missing list, version-specific codes, and hostile inputs: zip bomb, path
traversal, corrupt zip, empty file, malformed XML).

When an expectation and the engine disagree, the annotation is treated as the
specification and the engine is fixed.

## Rule test cases

Every rule in `src/core/rules/definitions.ts` declares `testCases`; they are
executed by `src/core/rules/rule-testcases.test.ts`. A rule whose cases fail
fails the whole suite.

## Recorded results (2026-11-01, V1.1.1 — independent takeover acceptance)

- Machine: AMD Ryzen 9 7945HX, 16 GB RAM, Windows 11 (build 26220), Node 24.19.0, pnpm 11.7.0
- `pnpm install --frozen-lockfile`: already up to date, no lockfile drift
- `pnpm typecheck`: 0 errors · `pnpm lint`: 0 errors, 2 warnings (pre-existing:
  `AppContext.tsx` react-refresh, one unused eslint-disable in `real-docx.test.ts`)
- `pnpm test`: **239 passed / 0 failed** (14 files) — 184 inherited from V1.1.0
  plus the reachability gate, the bounds suite and the fix-preview safety cases
- `pnpm exec playwright test`: **14 passed / 4 skipped** (Chromium + Firefox +
  WebKit). Skips are deliberate and Chromium-only by design: the offline-PWA and
  the clipboard suites (2 tests × 2 non-Chromium browsers)
- `pnpm build`: ok; `pnpm audit --prod` and `pnpm audit --audit-level moderate`:
  **0 vulnerabilities**
- Live site before the change (`scripts/live-verify.mjs`): 7 steps, `PAGEERRORS: none`,
  deployed `sw.js` = `rr-v1.1.0`
- Stress sample unchanged: 1223 blocks / 202 markers / 150 refs in **221 ms**
- External corpus re-measured after the fix: marker recall/precision **1.000/1.000**,
  deterministic errors TP=6 FP=0 FN=0, warnings TP=2 FP=0 FN=0, infos TP=4 FP=0 FN=0
  — the structural checks did not regress

## Recorded results (2026-11-01, v1.0.0)

- Machine: AMD Ryzen 9 7945HX, 16 GB RAM, Windows 10 (build 26220), Node 24.19.0
- `pnpm test` (v1.0.0 record): 117 passed — superseded by the v1.0.1 count below
- `pnpm test` (v1.0.1): **143 passed / 0 failed** — adds the external corpus gate
  (20 hand-annotated documents, see `docs/external-validation.md`) and the two
  new rules' test cases
- Performance stress sample (1223 blocks, 202 citation markers, 150 references):
  **180 ms** end-to-end (target < 10 s)
- E2E (`pnpm exec playwright test`): **10 passed, 0 failed, 2 skipped** across
  Chromium, Firefox and WebKit (skips: download suite is Chromium-only by
  config for PDF font fetch determinism; offline test is Chromium-only because
  offline emulation is asserted via Chromium's service-worker behavior)
- Browser PDF verification: text extraction via pypdf confirms Chinese title,
  stats, clause references and the full reference list are selectable
- Offline verification (Chromium): SW active → offline reload → sample
  analysis → HTML export → paste analysis, all pass with zero page errors
- `pnpm audit`: 0 vulnerabilities (dev included); production license check MIT/0BSD/Zlib-compatible

## Responsive layout verification

Playwright screenshots at tablet (768×1024) and mobile (390×844) viewports
(`scripts/responsive-shots.mjs`, production build): home, workbench and graph
views captured to `docs/screenshots/responsive-*.png`. One defect found and
fixed during the check (brand name wrapped vertically at 390px — nav now wraps
and the English subtitle hides below 640px). Verified after fix: single-column
feature cards on mobile, wrapped workbench toolbar, tabbed panels instead of a
squeezed three-column layout, graph scales to container width.

## Manual test scripts

`scripts/` contains the verification scripts used during development:
`ui-walkthrough.mjs` (full UI pass with screenshots), `pdf-verify.mjs`,
`offline-test.mjs`, `gen-icons.mjs`, `capture-docs-shots.mjs`. Run them
against a local preview build (`pnpm build && pnpm preview`).

`scripts/pwa-update-offline-check.mjs` (V1.1.1) is the reproducible PWA update
check: `pnpm build && node scripts/pwa-update-offline-check.mjs`. It installs the
worker, bumps only `dist/sw.js` (a gitignored build output, restored on exit),
and asserts the banner, the cache migration, the eviction of the previous
version’s cache, and that analysis + HTML export still work offline — ten
checks, all passing on the V1.1.1 branch. It changes nothing under version
control.
