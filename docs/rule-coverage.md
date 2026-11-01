# GB/T 7714 Rule Coverage

Last updated: 2026-11-01. This document states exactly which rules Reference
Radar implements per standard version, their source clauses, verification
status and test status. **Partial coverage is not full-standard compliance.**

## Source verification summary

| Item | Status |
|---|---|
| GB/T 7714—2025 status (现行) and dates | Verified via 全国标准信息公共服务平台 (std.samr.gov.cn) record: 发布 2025-12-02 / 实施 2026-07-01 / 现行 |
| GB/T 7714—2015 status (废止/被代替) | Same platform record |
| 2025 clause content used by rules | Read directly in the official standard text (45-page scan obtained from sycm.edu.cn, cover page visually verified against platform record) |
| 2015 clause numbers | Confirmed through the official 2025 foreword's cross-reference list (e.g. "2015年版的第10章" for 标注法) plus ≥2 independent university library guides |
| 2015 Annex B type codes | Verified via multiple independent secondary guides; cross-checked against the official 2025 foreword's Annex-A change list |
| Full standard text redistribution | **Not redistributed** (copyright); rules cite clause numbers + short paraphrases |

## Implemented rules (顺序编码制 scope)

| Rule ID | Check | 2025 clause | 2015 clause | Source status | Severity |
|---|---|---|---|---|---|
| RR-CIT-001 | Cited number exists in the reference list | 9.2.1.1 / 9.2.2 | 10.1.1 / 10.1.2 | 2025 official / 2015 secondary | error |
| RR-REF-002 | Duplicate reference numbers | 9.2.2 | 10.1.2 | same | error |
| RR-REF-003 | Numbering gaps (1..N continuous) | 9.2.2 | 10.1.2 | same | error (review when auto-numbered) |
| RR-CIT-004 | First-citation order matches sequential coding | 9.2.1.1 | 10.1.1 | same | error |
| RR-REF-005 | List entries sorted ascending by number | 9.2.2 | 10.1.2 | same | error |
| RR-CIT-006 | Range validity (inverted / degenerate ranges) | 9.2.1.2 | 10.1.1 | same | error / warning |
| RR-REF-007 | Duplicate entry text; near-duplicate suspicion | 9.2.1.3 | 10.1.1 | same | error / review |
| RR-FMT-008 | Type/carrier codes exist in the version's table | Annex A | Annex B | 2025 official / 2015 secondary | warning |
| RR-FMT-010 | Missing type identifier → manual review | 6.2 / 7.3 | 7.2 / 8 | same | review |
| RR-FMT-011 | Page ranges must use hyphen "-" (v1.0.1) | 6.2 | 7.2 | same | warning |
| RR-FMT-013 | Cited date required — **v1.1 audit: only for 网站网页(表10)/数据集(表14)/预印本(表15)**; 2015: EB warning + other /OL review (8.4.4) | 8.11.2 表10 / 8.14 表14 / 8.15 表15 | 8.4.4 | same | warning / review |
| RR-FMT-014 | EB/PP/DS entries require URL (v1.1) | 8.11.2 表10 / 8.15 表15 | — | official | warning |
| RR-FMT-015 | [D] missing degree-granting institution → review (v1.1) | 8.7.1 表6 | 4.5 | same | review |
| RR-FMT-016 | [J] without publication year → review; article number / online-first are legitimate (v1.1) | 8.5.1 / 8.5.2 表4 | 8.8 | same | review |
| RR-FMT-017 | Cited date not YYYY-MM-DD → warning with mechanical fix preview (v1.1) | 7.6 | 8.4.4 | same | warning |
| RR-FMT-018 | [S] without standard number → warning (v1.1); compressed "GB/T20090.16" form handled | 8.9.1 表8 | 4.4 | same | warning |
| RR-REF-011 | Uncited entries (info only, not a violation) | 9.2.2 | 10.1.2 | same | info |
| RR-SCOPE-012 | No reference list found | 9.2 | 10.1 | same | warning |
| RR-SCOPE-013 | Ambiguous bracketed markers → review queue | 9.2.1.2 | 10.1.1 | same | review |

**Rule count: 19** (v1.0.2: 14; v1.1.0 adds RR-FMT-014/015/016/017/018 and
rewrites RR-FMT-013 after the per-type 必备性 audit).

## V1.1 rule-correctness audit (2026-11-01)

Every 著录项目 table of GB/T 7714—2025 was read directly in the official scan
(pages 8–23 of the standard). Consequences applied in v1.1.0:

1. **引用日期 (cited date) is 必备 ONLY for 网站网页 (表10), 数据集 (表14) and
   预印本 (表15).** The 期刊析出 (表4), 图书 (表1), 学位论文 (表6), 报告 (表7),
   专利 (表9) and 标准 (表8) tables contain no cited-date element. RR-FMT-013
   was narrowed accordingly — the v1.0.1 behavior produced false positives on
   J/R/P/S/D-OL entries. The standard's own [J/OL] examples (8.5.3 示例4/6/9/10)
   carry no cited date.
2. **"有则必备" items cannot be judged deterministically** from entry text
   alone (出版地/出版者/出版年/年卷期/页码/版本 across types). Missing-item
   checks for those are either omitted (e.g. journal page numbers — article
   numbers and online-first dates are legitimate per 8.5.1.1 示例6/7) or
   emitted at **review** severity (e.g. journal year absent entirely).
3. **Deterministic (warning) checks exist only for 必备 items that are
   reliably detectable:** cited date (EB/DS/PP), URL (EB/PP), standard number
   ([S]), plus structural citation/list rules of clause 9.2. [D] institution
   and ambiguous shapes degrade to review.
4. 2015 edition: the unified electronic-resource cited-date requirement
   (8.4.4, verified-secondary) applies, but non-EB findings are downgraded to
   review to avoid false certainty.

## Version-specific code tables

- **2025 (official Annex A, read directly):** M 图书, J 期刊, N 报纸, C 会议录,
  D 学位论文, R 报告, S 标准, P 专利, EB 网站、网页, A 档案, CM 地图, DS 数据集,
  PP 预印本, G 汇编, CP 计算机程序, DB 数据库, Z 其他; carriers MT/DK/CD/OL/MM.
- **2015 (verified via ≥2 independent guides + official 2025 foreword change list):**
  M 普通图书, J, N, C 会议录, D, R, S, P, EB 电子公告, A 档案, CM 舆图, G 汇编,
  CP, DB, Z; carriers MT/DK/CD/OL (no DS/PP/MM).

A code valid in one version but not the other (e.g. [DS/OL] under 2015) is
reported by RR-FMT-008 with a version note.

## 2025-differentiated support

The official 2025 foreword (前言) enumerates all technical changes from 2015.
Differences implemented as behavioral checks:

1. New type codes DS / PP and carrier MM → accepted under 2025, warned under 2015 (RR-FMT-008).
2. EB meaning change (电子公告 → 网站、网页) → display-name level; no code-level check possible.
3. 普通图书→图书 / 舆图→地图 renaming → display-name level only.

Differences **not** implemented as checks (no machine-checkable clause text
extracted with sufficient certainty): detailed per-type 著录项目 completeness
for the 9 newly-formalized types (8.6–8.15). These are listed in the UI as
"尚未实现的检查项目".

## Explicit non-goals (not a compliance certification)

- 著者-出版年制 (author–year) citation style is NOT checked in V1.0; the
  numeric (顺序编码制) system is the supported scope. Documents using
  author–year style get no numbering conclusions.
- Full-text clause-by-clause compliance certification is explicitly out of scope.
- No page-layout or typography checks (页码位置、字体等排版不属于著录规则核查).

## Test status

- Every rule carries executable test cases (`src/core/rules/*`), run by a
  meta-test runner — a rule whose test cases fail fails the suite.
- 18 golden samples (`src/core/golden/samples.ts`) with hand-authored
  expectations cover the requirement matrix (missing refs, duplicates, order,
  ranges, run-splitting, tables, auto-numbering, footnotes/endnotes, Zotero
  fields, non-citation brackets, missing lists, version differences, hostile
  inputs). Expectations are written independently of program output.
