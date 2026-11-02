<div align="center">

# Reference Radar · 引文雷达

**Free, open-source, local-first citation & reference checker for academic papers — built around GB/T 7714 (Chinese national standard for bibliographic references).**

[Online demo](https://geyutu6755.github.io/reference-radar/) · [New-user guide](docs/user-guide.md) · [中文说明](README.zh-CN.md) · [Report an issue](https://github.com/geyutu6755/reference-radar/issues/new/choose)

*Every finding cites its standard clause and points at the exact text.*

</div>

---

![Workbench](docs/screenshots/workbench.png)

Upload a paper as **.docx** and Reference Radar — entirely in your browser, with no server, no account and no API key — finds:

- in-text numeric citations (`[1]`, `[2-4]`, `[1，3]`, full-width variants) and the reference list,
- the citation ↔ reference mapping, including **missing, duplicated and gapped numbers**,
- **first-citation ordering** problems under the sequential numbering system,
- duplicate or near-duplicate reference entries,
- document-type identifier codes that don't exist in the selected standard version,
- ambiguous bracketed numbers (math, data tables) that are deliberately **not** judged automatically.

## Online demo & offline app

The [demo site](https://geyutu6755.github.io/reference-radar/) is a full PWA:
install it from the browser menu and it keeps working **offline** — analysis and
HTML export included. PDF export needs one prior online export on a fresh
install, because the ~11 MB CJK font is deliberately not precached (see
[`docs/limitations.md`](docs/limitations.md)). Papers never leave the browser tab.

## Screenshot tour

| Home | Findings with rule basis |
|---|---|
| ![Home](docs/screenshots/home.png) | ![Issue basis](docs/screenshots/issue-basis.png) |

| Citation graph | Dark theme |
|---|---|
| ![Graph](docs/screenshots/graph.png) | ![Dark](docs/screenshots/graph-dark.png) |

## What it checks (and what it doesn't)

Rules are versioned per standard edition and every rule carries a source clause plus a verification status (read the matrix in [`docs/rule-coverage.md`](docs/rule-coverage.md)):

- **GB/T 7714—2025** (current, effective 2026-07-01) — **19 rules** (v1.1):
  citation↔list consistency, numbering, duplicates, type codes per edition,
  and entry-format checks grounded in the per-type 必备性 tables (cited date
  for 网页/数据集/预印本, URL, standard numbers, thesis institutions), with
  **mechanical fix previews** (before/after + one-click copy) for unambiguous
  normalizations like page separators and date formats — nothing is invented.
- **GB/T 7714—2015** (superseded) — same structural rules with 2015 clause numbering; 2025-only codes are flagged as undefined in this edition.
- **Independent validation:** an external 20-document corpus (separate
  generator, hand annotations) measures marker precision/recall and issue
  false positives — currently 1.000/1.000 with zero FPs; see
  [`docs/external-validation.md`](docs/external-validation.md).
- Explicitly **not** implemented: the author–year (著者-出版年制) style, field
  completeness for the remaining 2025 entry types (会议录/报告/档案/地图 等), and
  full-standard compliance certification. Elements the standard marks 有则必备
  (出版地、出版者、年卷期、页码…) are never reported as definite violations,
  because absence cannot be distinguished from “not applicable” in entry text.
  Uncited entries are reported as *info*, never as violations. See
  [`docs/limitations.md`](docs/limitations.md) and the
  [`docs/rule-coverage.md`](docs/rule-coverage.md) matrix.

## Why local-first?

Your manuscript is not our data. There is no backend: the DOCX is unzipped and parsed in your browser memory, nothing is persisted, and the service worker caches only static app assets. The claims match what you can verify in the network tab — see [`docs/privacy.md`](docs/privacy.md).

## Getting started

**Use it:** open the [demo](https://geyutu6755.github.io/reference-radar/) (or run locally below), drop a `.docx`, pick a standard version, analyze. Try the built-in sample paper — it runs the real engine.

**Develop:**

```bash
git clone https://github.com/geyutu6755/reference-radar.git
cd reference-radar
pnpm install
pnpm dev            # dev server
pnpm test           # unit + golden + hostile + perf tests
pnpm exec playwright test   # E2E (Chromium/Firefox/WebKit; builds + previews automatically)
pnpm build          # production build to dist/
```

Requirements: Node 20+, pnpm 9+. All commands are verified in [`docs/testing.md`](docs/testing.md).

## Technical overview

```
DOCX bytes → safe unzip (fflate + bomb/path guards)
           → OOXML parse (preserveOrder XML, runs/fields/revisions/tables/notes)
           → DocBlock[] with char-precise anchors
           → citations + reference entries (+ confidence)
           → version-selected GB/T 7714 rule engine → Issue[]
           → workbench UI / SVG graph / HTML+PDF reports
```

- React 19 + TypeScript strict, custom CSS design system (no CSS framework), Web Worker analysis pipeline
- PDF export embeds a subset of Noto Sans CJK SC (SIL OFL) so Chinese text stays selectable
- Hand-written service worker with a build-generated precache manifest

## Roadmap

Planned versions — nothing on this list is shipped yet; see
[`docs/limitations.md`](docs/limitations.md) for the current boundaries.

- **v1.1 — author–year system (著者-出版年制).** Citation-marker recognition for
  `(Crane, 1972)`-style in-text citations, name–date reference-list parsing and
  the corresponding rule set, versioned per standard edition like the numeric
  rules today.
- **v1.2 — wider document coverage.** Header/footer and text-box analysis,
  footnote-based reference-list (页下注文献表) consistency checks, and richer
  Zotero/Mendeley/EndNote field metadata parsing (beyond displayed text).
- **v1.3 — deeper entry-format rules.** Field-completeness checks for the entry
  types still uncovered among those formalized in GB/T 7714—2025 (会议录/报告/
  档案/地图 等), grounded in verified clause tables. 网站网页/数据集/预印本
  (URL, cited date), 学位论文 (degree-granting unit) and 标准 (standard number)
  shipped in v1.1 and were made reachable from real documents in v1.1.1.
- **Later.** Standalone npm publication of the parser and rule engine; a
  rule-coverage expansion driven by verifiable sources.

## Feedback & public beta

Try it on your own paper and tell us what breaks: [open an issue with the
matching template](https://github.com/geyutu6755/reference-radar/issues/new/choose)
— see [`docs/feedback.md`](docs/feedback.md) for the beta feedback plan and
[`docs/user-guide.md`](docs/user-guide.md) for a three-minute tutorial.

## Contributing

Issues and pull requests are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md). Rule additions must cite a source clause and include test cases; the meta-test runner executes every rule's declared cases.

## License

[MIT](LICENSE) — the bundled font subset is under the SIL Open Font License 1.1.
