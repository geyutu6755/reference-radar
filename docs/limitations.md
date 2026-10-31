# Limitations (v1.0.0)

Honest boundaries of the current release. Nothing here is claimed as checked.

## Standard coverage

- Only the **sequential numeric system (顺序编码制)** is checked. The
  author–year system (著者-出版年制) is out of scope for v1.0.
- 12 rule families are implemented; the full GB/T 7714 clause set is not.
  See the matrix in [rule-coverage.md](rule-coverage.md).
- Field-completeness checks for the nine entry types newly formalized in the
  2025 edition (会议录/学位论文/报告/标准/网站网页/档案/地图/数据集/预印本) are
  not implemented; entry-format findings are surfaced for manual review instead.
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

## Export

- PDF export fetches a bundled CJK font (~10.6 MB) on first use; glyphs outside
  its subset (e.g. rare Han extensions) render as □.
- The HTML/PDF reports mirror the on-screen findings; they add no extra rules.

## Known issues

- See [the issue tracker](https://github.com/geyutu6755/reference-radar/issues)
for live issues.
