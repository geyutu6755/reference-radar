# Testing Guide

## Test layers

| Layer | Command | What it covers |
|---|---|---|
| Unit + rules + golden + hostile + perf | `pnpm test` (Vitest) | parser, extractor, reference parsing, rule engine, 18 hand-annotated golden samples, 5 hostile inputs, stress performance |
| E2E | `pnpm exec playwright test` | full user path in Chromium/Firefox/WebKit against the production build, incl. offline PWA and downloads |
| Type/lint | `pnpm typecheck` / `pnpm lint` | strict TS, ESLint |
| Build | `pnpm build` | production bundle |

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

## Recorded results (2026-11-01, v1.0.0)

- Machine: AMD Ryzen 9 7945HX, 16 GB RAM, Windows 10 (build 26220), Node 24.19.0
- `pnpm test`: **117 passed / 0 failed / 0 skipped**
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

## Manual test scripts

`scripts/` contains the verification scripts used during development:
`ui-walkthrough.mjs` (full UI pass with screenshots), `pdf-verify.mjs`,
`offline-test.mjs`, `gen-icons.mjs`, `capture-docs-shots.mjs`. Run them
against a local preview build (`pnpm build && pnpm preview`).
