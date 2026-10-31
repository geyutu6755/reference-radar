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

## Build/test verification

(updated as phases complete)
