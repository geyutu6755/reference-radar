# Progress

Live status of the V1.0 development plan. Updated each iteration.

## Phase A — Research & initialization ✅

- Workspace initialized (Vite + React 19 + TypeScript strict + Vitest + Playwright, pnpm).
- Standard verification (see `docs/verification.md`):
  - Official record confirmed via 全国标准信息公共服务平台 (std.samr.gov.cn):
    GB/T 7714—2025 发布 2025-12-02, 实施 2026-07-01, **现行**;
    GB/T 7714—2015 已被代替（**废止**）。
  - Official standard text obtained (45-page scan, cross-checked page-by-page
    against platform record; cover page verified visually).
  - Official foreword (前言) change list 2015→2025 extracted and used as the
    authoritative basis for version-differentiated rules.
- First commit.

## Phase B — Parsing engine

- [x] Core domain model (`src/core/types.ts`)
- [ ] DOCX unzip + security limits
- [ ] OOXML structural parse (blocks, runs, tables, footnotes, fields, revisions)
- [ ] Citation extraction + disambiguation
- [ ] Reference section detection + entry parsing
- [ ] Unit tests

## Phase C — Rule engine

- [ ] Versioned rule registry (2015 / 2025)
- [ ] Structural checks (missing/duplicate/gaps/order)
- [ ] Format checks grounded in verified clauses
- [ ] Golden sample suite (18 samples)

## Phase D — UI ✅

- [x] Design system, home, workbench, graph, report views
- [x] i18n (zh-CN/en), themes, a11y
- [x] Browser walkthrough with screenshots (see scripts/ui-walkthrough.mjs)

## Phase E — Offline & export ✅

- [x] PWA (manifest, icons, SW precache + runtime font cache, update prompt)
- [x] Offline verification (reload / analysis / exports all pass offline)
- [x] HTML report (self-contained, escaped)
- [x] PDF report (pdf-lib + CJK subset font, selectable text, verified via pypdf)
- [x] Performance: stress sample 1223 blocks / 202 markers / 150 refs → 180 ms (<10 s target)
- [x] Security: 0 npm vulnerabilities (incl. dev), CSP, path-traversal & zip-bomb guards tested

## Phase F — Open-source release

- [ ] Docs, CI, screenshots
- [ ] GitHub repo + Pages deploy + Release

## Phase G — Acceptance

- [ ] Fresh-sample end-to-end walkthrough
- [ ] Final quality gate
