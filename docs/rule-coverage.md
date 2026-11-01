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
| RR-FMT-013 | Online (/OL) entries require cited date [YYYY-MM-DD] (v1.0.1) | 7.6 / 8.11 | 8.4.4 | same | warning |
| RR-REF-011 | Uncited entries (info only, not a violation) | 9.2.2 | 10.1.2 | same | info |
| RR-SCOPE-012 | No reference list found | 9.2 | 10.1 | same | warning |
| RR-SCOPE-013 | Ambiguous bracketed markers → review queue | 9.2.1.2 | 10.1.1 | same | review |

**Rule count: 14** (12 structural/format families in v1.0.0 + RR-FMT-011 and
RR-FMT-013 added in v1.0.1 from the verified clause text of chapter 6.2 and 7.6).

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
