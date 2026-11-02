# Limitations

Honest boundaries of the current release. Nothing here is claimed as checked.
Version history lives in [CHANGELOG.md](../CHANGELOG.md); this file describes
what the tool **cannot** do today.

## Standard coverage

- Only the **sequential numeric system (顺序编码制)** is checked. The
  author–year system (著者-出版年制) is out of scope.
- 19 rules are implemented (see [rule-coverage.md](rule-coverage.md) for the
  per-version matrix); the full GB/T 7714 clause set is not.
- Entry-format completeness is checked only where the standard makes an element
  必备 **and** its absence is reliably detectable from entry text: cited date
  (网站/网页/数据集/预印本), access path (EB/PP/DS), standard number ([S]), degree
  granting unit ([D], review-level). Elements recorded as 有则必备 — 出版地、出版者、
  出版年、年卷期、页码、版本 — cannot be judged from text alone and are either
  omitted or emitted as review items.
- Per-type field completeness for the other 2025 entry types (会议录/报告/专利/
  档案/地图 等) is not implemented; those are listed in the UI under
  “尚未实现的检查项目”.
- No full-standard compliance certification is offered or implied.

## Document parsing

- Page numbers shown are block/paragraph positions, not original Word page
  numbers (DOCX does not reliably encode pagination).
- Headers, footers and text boxes are not analyzed (declared in the scope
  panel).
- Citations in footnotes/endnotes are extracted, but footnote-based reference
  lists (页下注文献表) are not checked for list consistency.
- Field-based citations (Zotero/Mendeley/EndNote) are analyzed by their
  displayed text only; the field metadata code is not parsed.
- Complex equations are represented as a placeholder; numbers inside them are
  never treated as citations.
- Heavily stylized or non-standard reference headings may not be detected; an
  entry-run fallback covers common unheaded lists.
- **List segmentation can fail, and now says so**: if the detected reference
  section yields no numbered entries (typically lost Word auto-numbering), or if
  more unlabeled paragraphs follow one entry than a single entry can plausibly
  span, the analysis stops merging and records a warning in 分析范围 / the
  exported report. Numbering conclusions are then unreliable — the tool no
  longer presents a fused mega-entry as a set of “missing reference” errors.

## Export

- PDF export fetches the bundled CJK font (~10.6 MB) on first use, and that font
  is deliberately **not** precached; offline PDF export therefore requires one
  earlier online export (offline HTML export and offline analysis need no such
  warm-up). Glyphs outside the subset (e.g. rare Han extensions) render as □.
- The HTML/PDF reports mirror the on-screen findings; they add no extra rules.

## Known issues

- See [the issue tracker](https://github.com/geyutu6755/reference-radar/issues)
for live issues.
