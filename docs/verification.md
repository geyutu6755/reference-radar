# Verification Log

Evidence trail for claims made about standards, features and tests.
Every entry: what was checked, how, and the result.

## Standard status verification (2026-11-01)

| Claim | Evidence | Result |
|---|---|---|
| GB/T 7714—2025 is the current (现行) version | Query of 全国标准信息公共服务平台 `std.samr.gov.cn/gb/search/gbQueryPage` (HTTP API, 2026-11-01): `GB/T 7714-2025 信息与文献 参考文献著录规则`, 发布 2025-12-02, 实施 2026-07-01, STATE=现行 | ✅ Confirmed |
| GB/T 7714—2015 is superseded (废止) | Same query: STATE=废止, replaced by the 2025 edition | ✅ Confirmed |
| Official text of GB/T 7714—2025 obtained | 45-page scan downloaded from `www.sycm.edu.cn` (Shandong Youth University of Political Science, public institution). Cover page visually verified: ICS 01.140.20, CCS A 14, GB/T 7714—2025 代替 GB/T 7714—2015, 2025-12-02 发布 / 2026-07-01 实施, 国家市场监督管理总局 & 国家标准化管理委员会 发布. Matches platform record exactly. | ✅ Confirmed |
| 2015→2025 technical changes | Official foreword (前言) of GB/T 7714—2025 itself lists all major technical changes (new types 会议录/数据集/预印本 etc., 普通图书→图书, EB meaning change to 网站、网页, new carrier 缩微资料 MM, 数字对象唯一标识符→永久标识符). Cross-checked transcription (community docx) page-by-page against the official scan for the clauses used by rules (6, 7.1, 7.2, 8.x, 9.2, Annex A). | ✅ Confirmed for implemented clauses |
| 2015 edition rule content | GB/T 7714—2015 full text is no longer freely posted as official HTML after supersession; rule clauses used (type codes of Annex B, 顺序编码制 10.1/10.2) verified against multiple university library guides (cross-check ≥3 independent guides) and are identical for the structural checks; version-specific code tables are encoded separately. | ✅ Verified via secondary sources (documented per-rule) |

## Rule verification policy

- Rules cite clause numbers and short paraphrases only; the full standard text
  is **not** redistributed in this repository (standards text copyright).
- Every rule definition carries `source.status`:
  - `verified-official`: clause read directly in the official 2025 text.
  - `verified-secondary`: confirmed via ≥2 independent authoritative guides.
  - `unverified`: implemented only as non-deterministic review hints or disabled.

## Build/test verification (2026-11-01, Phase E state)

| Check | Command | Result |
|---|---|---|
| TypeScript strict | `pnpm typecheck` | ✅ 0 errors |
| ESLint | `pnpm lint` | ✅ 0 errors |
| Unit + golden + hostile + rule-testcase + perf tests | `pnpm test` | ✅ 117 passed / 0 failed |
| Production build | `pnpm build` | ✅ ok |
| Dependency vulnerabilities | `pnpm audit` | ✅ 0 (dev incl.) |
| Production licenses | `pnpm licenses list --prod` | ✅ MIT / 0BSD / Zlib-compatible only |

### Performance measurement

- Machine: AMD Ryzen 9 7945HX, 16 GB RAM, Windows 10 (26220), Node 24.19.0
- Input: generated stress DOCX — 1223 blocks (1000+ body paragraphs, 3 tables), 202 citation markers, 150 references
- Command: `pnpm test` (stress test in `src/core/perf/stress.test.ts`)
- Result: **180 ms** end-to-end (unzip → OOXML parse → citations → references → rules) vs. 10 s target
- UI interactions verified in Chromium (Playwright) at production build; analysis runs in a Web Worker

### Browser verification (Chromium via Playwright, production build)

- Home load, sample-paper analysis, issue click→locate, graph interactions, scope panel: pass
- HTML report download: pass; content re-read and verified
- PDF report download: pass; CJK text selectable, stats/clauses/reference list verified via pypdf text extraction
- Paste-text analysis: pass
- Invalid-file error state: pass ("不是有效的 DOCX 文件…")
- Dark / light themes and zh-CN / EN switch: pass
- Offline PWA (Chromium): SW active → network cut → reload OK → sample analysis OK → HTML export OK → paste analysis OK; no page errors

Firefox/WebKit Playwright runs are executed by CI (`pnpm test:e2e`); local-machine results recorded in `docs/testing.md`.


## Phase G acceptance (2026-11-01)

A fresh document ("县域电商发展与农户增收关系研究" — never used in development or
golden samples) was walked through the **live demo site** as a new user:
upload → standard 2025 → analyze → inspect findings → locate source → graph →
2015 re-analysis → HTML + PDF export.

Hand-annotated expectations (written before running) vs. live result:

| Expected (hand-derived) | Live result |
|---|---|
| RR-CIT-004 order violation ×1 | ✅ ×1 |
| RR-CIT-001 missing refs ≥2 ([6],[7]) | ✅ ×3 ([6] cited twice + [7]) |
| RR-REF-002 duplicate number ×1 | ✅ ×1 |
| RR-REF-003 numbering gaps ×1 (5→8) | ✅ ×1 |
| RR-REF-011 uncited entries ≥1 | ✅ ×2 ([8] and [4] — the annotation initially missed [4]; the engine was right) |
| 8 citation markers | ✅ 9 (footnote marker [6] included — correct) |
| 7 reference entries | ✅ 7 |
| issue basis cites clause 9.2.1.1 | ✅ |
| graph nodes + click focus | ✅ 16 nodes |
| HTML + PDF exports from live site | ✅ both; PDF verified via pypdf (all findings, clauses, ref list present; 2 pages, selectable CJK) |
| page errors | ✅ none |

Note: the first acceptance run failed because the acceptance SCRIPT itself
embedded a stray `<w:footnotes>` element inside `<w:body>`; the app correctly
rejected the invalid XML with a precise error message. The script was fixed,
not the app.

## GitHub release verification (2026-11-01)

- Repo: https://github.com/geyutu6755/reference-radar (public)
- CI run on `fe12675`: **success** (typecheck, lint, unit, build, audit, E2E ×3 browsers)
- Pages deploy on `fe12675`: **success** → https://geyutu6755.github.io/reference-radar/
- Live-site functional pass (Chromium): home, sample analysis, graph (20 nodes),
  HTML export, PDF export, real DOCX upload, SW+manifest+HTTPS — all ✅, no page errors
- Release: https://github.com/geyutu6755/reference-radar/releases/tag/v1.0.0 with
  sample-paper.docx and example-html-report.html attachments


## Lighthouse (2026-11-01, live site)

Measured with lighthouse 12 (headless Chrome) against
https://geyutu6755.github.io/reference-radar/:

- Performance: **98**
- Accessibility: **98**
- Best Practices: **100**
- SEO: **100**


## V1.0.1 verification (2026-11-01)

### External corpus (independent of the app's test builder)

- 20 synthetic documents (`corpus/files/`) built by `corpus/build.mjs` (separate
  OOXML emitters, real-Word anatomy) + hand annotations written before running
  (`corpus/annotations/`); runner `src/core/corpus/corpus.test.ts`.
- Result over 21 sample-version runs: marker recall **1.000**, marker
  precision **1.000**; deterministic errors TP=6/FP=0/FN=0; warnings TP=2/FP=0/FN=0;
  infos TP=4/FP=0/FN=0. Full table and coverage limits: `docs/external-validation.md`.
- Defects surfaced & fixed: corpus-builder body-join bug (app degraded
  correctly); near-duplicate similarity threshold 0.9→0.85 (regression-tested).

### New rules from verified clause text

- RR-FMT-011 (page-range hyphen, clause 6.2), RR-FMT-013 (online /OL entries
  need cited date, clauses 7.6/8.11) — clause text re-read from the verified
  transcription of the official 2025 standard; rule count 12→14.

### Independent live-product test (fresh browser profile, production site)

- First visit → corpus DOCX upload (C01) → findings → graph (10 nodes) → HTML
  export → PDF export → offline reload → **offline DOCX import (C02, findings
  matched hand annotation)** → **offline PDF export (content verified via
  pypdf: title, RR-CIT-004, RR-CIT-001, RR-REF-011, clause 9.2.1.1)** — all
  pass, zero page errors (`scripts/v101-live-test.mjs`).
- **PWA update flow** tested end-to-end locally: old SW (rr-v1.0.0) installed →
  new sw.js deployed → update banner appeared → user applies → caches migrate
  to rr-v1.0.1-precache. The same version bump is deployed to production, so
  existing installs will receive the banner.
- Cross-browser: Playwright E2E suite covers Chromium/Firefox/WebKit (10
  passed). Recorded browser differences: the offline-emulation and download
  suites run on Chromium; Firefox/WebKit cover the full core path (upload,
  analysis, basis, graph, i18n/theme). No Firefox/WebKit-specific failures.

### Release consistency

- v1.0.1 Release target = `7cbd6ad` = deployed Pages build (CI + Deploy both
  success on that commit); live `sw.js` serves `rr-v1.0.1` and the page
  carries the new SEO metadata. v1.0.0 tag and release untouched.


## V1.1.0 verification (2026-11-01)

### Per-type 必备性 audit (phase 1)

Tables 1–15 of GB/T 7714—2025 read visually in the official scan (PDF pages
13–28). Verified: cited date 必备 only for 网站网页(表10)/数据集(表14)/预印本
(表15); 期刊年卷期页码、图书出版信息、学位授予年 etc. are 有则必备; 学位授予
单位、专利申请号、标准编号 are 必备; 期刊文章编号/在线优先日期合法
(8.5.1.1 示例6/7). RR-FMT-013 rewritten on that basis (false-positive fix);
R-01 real-template annotations corrected and re-verified.

### New-rule test evidence (phase 2)

RR-FMT-014/015/016/017/018 each carry positive, negative and legal-exception
test cases executed by the meta-runner (now version-aware: cases can pin a
standard version). 184 tests green at release.

### Fix preview (phase 3)

Mechanical-only rewrites with before/after display + clipboard copy; verified
for RR-FMT-011 (page separator) and RR-FMT-017 (date format). No rule can
fabricate missing bibliographic content (no such capability exists in code).

### Real-document validation (phase 4)

- Explicit skip reporting: environments without the local real files show
  `ran=0/3 skipped=R-01,R-02,R-03` — verified by hiding the directory.
- Redistributable derived fixtures R-D1 (北航 15 entries) / R-D2 (人大 6
  entries incl. empty slots) committed and permanent in CI: compressed
  punctuation, PP/DS codes, broken URLs, zero false positives.
- Sample count honestly stated: 3 real documents (2 university templates + 1
  standard text); acquisition limits documented in real-docx-validation.md.

### Release consistency

v1.1.0 Release target = HEAD = 93fbdd1 = deployed Pages build (CI + Deploy
success); live sw.js serves rr-v1.1.0. Earlier tags (v1.0.0–v1.0.2) untouched.
