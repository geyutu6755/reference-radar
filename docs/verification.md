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
