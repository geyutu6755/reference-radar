/**
 * Reference Radar — core domain model.
 *
 * These structures are the versioned intermediate representation shared by the
 * document parser, citation extractor, reference parser, rule engine, graph
 * engine and report engine. They are UI-independent and designed to be
 * serializable so analysis can run in a Web Worker.
 */

/** Supported GB/T 7714 standard versions. */
export type StandardVersion = "2015" | "2025";

/** Where a piece of content physically lives inside the DOCX package. */
export type ContainerKind =
  | "body"
  | "table-cell"
  | "textbox"
  | "footnote"
  | "endnote"
  | "header"
  | "footer";

/** Coarse region of the document, used for scoping checks. */
export type DocRegion = "body" | "references" | "front" | "unknown";

/** How confident the parser is about a piece of extracted data. */
export type Confidence = "high" | "medium" | "low";

/**
 * Precise anchor back into the source document.
 * `containerId` identifies the container (e.g. "body", "tbl1:r2:c3", "fn:3"),
 * `paragraphId` identifies the paragraph inside that container and the char
 * offsets locate the match within the merged paragraph text.
 */
export interface LocationAnchor {
  containerId: string;
  containerKind: ContainerKind;
  paragraphId: string;
  /** Index of the paragraph among all rendered blocks (stable ordering). */
  blockIndex: number;
  /** Character offsets into the paragraph's merged plain text. */
  charStart: number;
  charEnd: number;
  /** The exact matched source text. */
  text: string;
}

/** Parser observations about special Word features affecting a block. */
export interface ParseNote {
  code:
    | "revised-insertion"
    | "revised-deletion"
    | "hidden-text"
    | "field-code"
    | "field-result-unresolved"
    | "zotero-field"
    | "mendeley-field"
    | "endnote-field"
    | "auto-numbered"
    | "multi-paragraph-entry"
    | "image-formula"
    | "hyperlink"
    | "unsupported-structure";
  detail?: string;
}

/** A rendered, linear "block" of the document used for preview + anchoring. */
export interface DocBlock {
  id: string;
  kind: "heading" | "paragraph" | "table-cell" | "footnote" | "endnote";
  text: string;
  containerId: string;
  containerKind: ContainerKind;
  blockIndex: number;
  /** Heading level 1..6 when kind === "heading". */
  headingLevel?: number;
  /** True if the paragraph belongs to the detected reference list. */
  region: DocRegion;
  styleName?: string;
  /** Rendered Word auto-numbering prefix, e.g. "3.1" or "（1）". */
  numberingText?: string;
  notes: ParseNote[];
  /** Run spans for fine-grained display (superscript/hidden/revised). */
  spans?: Array<{
    start: number;
    end: number;
    flags: {
      hidden?: boolean;
      deleted?: boolean;
      fieldResult?: boolean;
      fieldInstr?: boolean;
      hyperlink?: boolean;
      formula?: boolean;
      inserted?: boolean;
      superscript?: boolean;
    };
  }>;
}

/** One logical number segment inside a citation, as displayed. */
export interface CitationSegment {
  kind: "single" | "range";
  start: number;
  end: number;
  /** Offset of this segment within the citation raw text. */
  rawStart: number;
  rawEnd: number;
}

/** A bracketed numeric citation marker found in the document. */
export interface Citation {
  id: string;
  /** Full raw text as displayed, e.g. "[2-4]" or "［1，3—5］". */
  raw: string;
  /** Expanded logical reference numbers, e.g. [2,3,4]. */
  numbers: number[];
  segments: CitationSegment[];
  anchor: LocationAnchor;
  /** Text around the marker for context display. */
  contextBefore: string;
  contextAfter: string;
  /** Global appearance order (0-based) among detected citations. */
  order: number;
  /** True for the first occurrence of each distinct number. */
  isFirstOccurrenceOf: number[];
  detection: {
    confidence: Confidence;
    /** Machine-readable reasons supporting/limiting the classification. */
    signals: string[];
    /** True if this may not be a citation (review required). */
    needsReview: boolean;
  };
}

/** Bibliographic fields parsed out of one reference entry. */
export interface ReferenceFields {
  authors?: string[];
  title?: string;
  /** e.g. "[J/OL]" — full type/carrier identifier as printed. */
  typeIdentifier?: string;
  /** Bare type code, e.g. "J". */
  typeCode?: string;
  /** Bare carrier code, e.g. "OL". */
  carrierCode?: string;
  year?: string;
  source?: string;
  volume?: string;
  issue?: string;
  /** Page range normalised to the `24-33` shape. */
  pages?: string;
  /**
   * Page range exactly as printed (V1.1.1). Rules must read this, because the
   * separator characters they police are erased by normalisation.
   */
  pagesRaw?: string;
  doi?: string;
  url?: string;
  /** Cited date in `YYYY-MM-DD` form when the printed value can be determined. */
  citedDate?: string;
  /**
   * Cited date exactly as printed inside its square brackets (V1.1.1).
   * Present-but-malformed must stay distinguishable from absent, otherwise a
   * format problem is reported as a missing required element.
   */
  citedDateRaw?: string;
  publisher?: string;
  place?: string;
  edition?: string;
}

/** One entry of the reference list. */
export interface ReferenceEntry {
  id: string;
  /** Parsed ordinal number (1-based). */
  index: number;
  /** The number label as printed in the document, e.g. "[12]". */
  displayNumber: string;
  numberingKind: "manual" | "auto" | "none";
  /** Entry text without the leading number label. */
  raw: string;
  fields: ReferenceFields;
  fieldsConfidence: Confidence;
  anchor: LocationAnchor;
  notes: ParseNote[];
}

/** Directed relation between a citation occurrence and a reference entry. */
export interface Relation {
  citationId: string;
  referenceId: string;
  /** Reference ordinal cited by the citation. */
  number: number;
  /** True when the citation number has no matching reference entry. */
  missing: boolean;
}

export type Severity = "error" | "warning" | "review" | "info";

export type RuleCategory =
  | "citation-reference-consistency"
  | "numbering"
  | "reference-list"
  | "entry-format"
  | "type-identifier"
  | "scope";

/** How the rule's source clause was verified. */
export type SourceVerificationStatus =
  | "verified-official" // clause read in the official standard text obtained from an authoritative channel
  | "verified-secondary" // confirmed via multiple reputable secondary guides
  | "unverified"; // documented but not enabled for deterministic conclusions

export interface RuleSourceReference {
  /** Standard clause, e.g. "9.2.1.2". */
  clause: string;
  /** Original clause this replaces in the other version, if version-specific. */
  priorClause?: string;
  /** Short paraphrase of the requirement (never a full copy of the standard). */
  summary: string;
  status: SourceVerificationStatus;
}

export interface Issue {
  id: string;
  ruleId: string;
  standardVersion: StandardVersion;
  category: RuleCategory;
  severity: Severity;
  /** Short localized-safe key + parameters for UI rendering. */
  messageKey: string;
  messageParams?: Record<string, string | number>;
  /** English fallback text (always present for reports). */
  detail: string;
  suggestion?: string;
  anchors: LocationAnchor[];
  source: RuleSourceReference;
  /** Machine confidence in this specific finding. */
  confidence: Confidence;
  requiresManualCheck: boolean;
  /** Related citation/entry ids for graph highlighting. */
  relatedIds: string[];
  /**
   * Mechanical, no-fabrication fix preview: only the exact substring is
   * rewritten (e.g. normalizing a date format). Present only when the fix
   * can be produced without inventing any bibliographic content.
   */
  fixPreview?: {
    find: string;
    replace: string;
    description: string;
  };
}

export interface RuleTestCase {
  name: string;
  input: RuleTestInput;
  expect: RuleTestExpectation;
  /** When set, the case only runs under this standard version. */
  version?: StandardVersion;
}

export interface RuleTestInput {
  citations?: Partial<Citation>[];
  references?: Partial<ReferenceEntry>[];
  relations?: Partial<Relation>[];
  options?: Record<string, unknown>;
}

export interface RuleTestExpectation {
  /** Number of issues expected from the rule (exact). */
  issueCount?: number;
  /** Substrings expected in issue details. */
  detailIncludes?: string[];
  severity?: Severity;
}

export interface RuleContext {
  version: StandardVersion;
  citations: Citation[];
  references: ReferenceEntry[];
  relations: Relation[];
  blocks: DocBlock[];
  notes: ParseNote[];
  scope: AnalysisScope;
}

export interface RuleDefinition {
  ruleId: string;
  /** Versions this rule applies to (may be both when clauses are shared). */
  standardVersions: StandardVersion[];
  category: RuleCategory;
  severity: Severity;
  source: RuleSourceReference;
  /** Human explanation of what the rule inspects. */
  explanation: string;
  suggestedFix?: string;
  /** Whether findings of this rule always need human confirmation. */
  requiresManualCheck?: boolean;
  check: (ctx: RuleContext) => Omit<Issue, "id" | "standardVersion">[];
  testCases: RuleTestCase[];
}

export interface AnalysisScope {
  /** Which containers were actually analyzed. */
  analyzedContainers: ContainerKind[];
  /** Explicit statements about what was NOT analyzed. */
  excludedNotes: string[];
  /** Reference section detection info. */
  referenceSectionDetected: boolean;
  referenceSectionTitle?: string;
}

export interface AnalysisStats {
  blockCount: number;
  citationCount: number;
  citationMarkerCount: number;
  distinctCitedNumbers: number;
  referenceCount: number;
  rulesRun: string[];
  errorCount: number;
  warningCount: number;
  reviewCount: number;
  infoCount: number;
}

/** Full result of analyzing one document. */
export interface AnalysisResult {
  fileName: string;
  analyzedAt: string;
  version: StandardVersion;
  blocks: DocBlock[];
  citations: Citation[];
  references: ReferenceEntry[];
  relations: Relation[];
  issues: Issue[];
  stats: AnalysisStats;
  scope: AnalysisScope;
  /** Non-fatal warnings raised by the parser itself. */
  parseWarnings: string[];
}
