# External Corpus Validation (v1.0.1)

独立语料验证 — separate from the 117 unit/golden tests and from the app's own
test builder. Performed 2026-11-01 against the v1.0.1-candidate engine.

## What makes this corpus independent

1. **Separate generator.** `corpus/build.mjs` shares no code with
   `src/testing/docx-builder.ts`. Its OOXML emitters mimic how real Word
   documents look: namespace-piled `<w:document>` headers, eastAsia font hints
   on every run, `w:jc` alignment, bookmarks, `w:sectPr`, real
   `w:footnoteReference` anatomy and real field-code shapes.
2. **Fixed binary fixtures.** The 20 `.docx` files are committed under
   `corpus/files/` — the engine always runs against these exact bytes.
3. **Hand annotations written first.** `corpus/annotations/*.json` were derived
   from each document's construction *before* any engine run, including exact
   ruleId multisets per severity.

## Sample set (20 documents / 21 version runs)

| ID | Scenario | Key expected outcome |
|---|---|---|
| C01 | standard zh paper, all correct | 0 issues |
| C02 | missing reference ([5] w/o entry) | RR-CIT-001 + RR-CIT-004 + uncited info |
| C03 | duplicate entry number | RR-REF-002 |
| C04 | first-citation order violation | RR-CIT-004 |
| C05 | inverted range [4-2] | RR-CIT-006 + review + uncited info |
| C06 | identical duplicate entries | RR-REF-007 (error) |
| C07 | uncited entry | RR-REF-011 info only |
| C08 | Word auto-numbered list (numbering.xml) | parsed, 0 issues |
| C09 | citation inside footnote (real footnoteReference) | detected |
| C10 | Zotero field citation (real field anatomy) | detected from display text |
| C11 | table with data labels + citation | citation kept, data label → review |
| C12 | full-width brackets, full-width comma, em-dash range | all detected |
| C13 | vectors/intervals/units in brackets | 0 deterministic errors, ≥2 reviews |
| C14 | no reference list | RR-SCOPE-012 warning |
| C15 | corrupt file (not ZIP) | rejected with `not-docx` |
| C16 | multi-paragraph entry | merged, 0 structural issues |
| C17 | English paper ("References") | detected, 0 issues |
| C18 | zh paper with "References" heading | detected, 0 issues |
| C19 | near-duplicate entries (same author/issue, pages differ) | review (manual confirm) |
| C20 | [DS/OL] code — version difference | 2025 clean; 2015 → RR-FMT-008 |

## Results (measured by `src/core/corpus/corpus.test.ts`)

21 sample-version runs; marker-level and issue-level scoring against the hand
annotations:

| Metric | Value |
|---|---|
| Citation-marker recall | **1.000** (every annotated marker detected) |
| Citation-marker precision | **1.000** (no detections outside annotations) |
| Deterministic-error issues | TP = 6, **FP = 0**, **FN = 0** |
| Warning issues | TP = 2, **FP = 0**, **FN = 0** |
| Info issues | TP = 4, **FP = 0**, **FN = 0** |
| Review-queue floor | met in every sample that required it |

These thresholds are enforced as a permanent test gate: any future change that
introduces a corpus FP/FN fails the suite.

## Defects the corpus surfaced

1. **Corpus builder defect (not shipped code):** the first build emitted
   `body.join(",")` commas into the XML and serialized the C10 field paragraph
   as `[object Object]`. The application parser handled the malformed XML
   without crashing — blocks were missing for the damaged paragraph, which is
   the correct degradation. Fixed in the generator; the app needed no change.
2. **Engine tuning (real):** near-duplicate detection used a Levenshtein
   similarity threshold of 0.9; C19-style same-author/same-issue pairs that
   differ only in page numbers score ≈0.86 and were silently missed. Threshold
   lowered to **0.85** — such pairs now surface as *review* items (human
   confirms), with `requiresManualCheck: true`. No corpus or golden sample
   produced a false positive at the new threshold.

## Coverage limits (stated honestly)

- 20 documents are **synthetic**: they cover the enumerated common formats but
  are not natural papers. Real-word variance (odd templates, unusual styles,
  scanned content, mixed numbering systems) is not represented.
- The corpus checks the numeric (顺序编码制) system only; author–year papers
  are out of scope in v1.0.x.
- Scanned/image-based DOCX (no text layer) and encrypted files are outside the
  corpus; the former yields no text to analyze (scope note shown), the latter
  is rejected.
- Precision/recall here are exact-set metrics on constructed documents; they do
  not estimate field accuracy on natural documents. That remains future work
  (planned as a public-beta feedback loop, see `docs/feedback.md`).
