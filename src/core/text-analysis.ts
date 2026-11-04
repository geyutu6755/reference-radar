/**
 * Text-based analysis: pasted plain text → pseudo-blocks → same extraction
 * and rule pipeline as DOCX (a real analysis, not canned output).
 */
import type { AnalysisResult, AnalysisScope, ContainerKind, DocBlock, StandardVersion } from "./types";
import { extractCitations } from "./extract/citations";
import { applyReferenceRegion, detectReferenceSection } from "./references/detect";
import { parseReferenceEntries } from "./references/parse";
import { buildRelations } from "./graph/relations";
import { ruleFailureWarning, runRules } from "./rules/engine";

export function analyzeText(text: string, fileName: string, options: { version: StandardVersion }): AnalysisResult {
  const blocks: DocBlock[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isHeading = /^(第[一二三四五六七八九十\d]+[章节部分]|[一二三四五六七八九十][、.]|\d+(\.\d+)*\s+\S)/.test(trimmed) && trimmed.length < 40;
    blocks.push({
      id: `text:p${i}`,
      kind: isHeading ? "heading" : "paragraph",
      text: trimmed,
      containerId: "text",
      containerKind: "body",
      blockIndex: blocks.length,
      headingLevel: isHeading ? 1 : undefined,
      region: "body",
      notes: [],
    });
  }

  const section = detectReferenceSection(blocks);
  if (section) applyReferenceRegion(blocks, section);

  const { citations, entryLike } = extractCitations(blocks);
  let references = section ? parseReferenceEntries(blocks, section.startIndex + 1, section.endIndex).entries : [];
  if (references.length === 0 && !section && entryLike.length >= 2) {
    references = parseReferenceEntries(blocks, entryLike[0]!, blocks.length - 1).entries;
  }
  const relations = buildRelations(citations, references);

  const scope: AnalysisScope = {
    analyzedContainers: ["body"] as ContainerKind[],
    excludedNotes: [
      "粘贴文本模式：无脚注、尾注、表格或域信息可分析。/ Pasted-text mode: no footnotes, tables or field data available.",
    ],
    referenceSectionDetected: !!section,
    referenceSectionTitle: section?.title,
  };

  const ruleWarnings: string[] = [];
  const issues = runRules(
    { version: options.version, citations, references, relations, blocks, notes: [], scope },
    (ruleId, error) => ruleWarnings.push(ruleFailureWarning(ruleId, error))
  );

  return {
    fileName,
    analyzedAt: new Date().toISOString(),
    version: options.version,
    blocks,
    citations,
    references,
    relations,
    issues,
    stats: {
      blockCount: blocks.length,
      citationCount: citations.filter((c) => !c.detection.needsReview).length,
      citationMarkerCount: citations.length,
      distinctCitedNumbers: new Set(citations.flatMap((c) => c.numbers)).size,
      referenceCount: references.length,
      rulesRun: [...new Set(issues.map((i) => i.ruleId))],
      errorCount: issues.filter((i) => i.severity === "error").length,
      warningCount: issues.filter((i) => i.severity === "warning").length,
      reviewCount: issues.filter((i) => i.severity === "review").length,
      infoCount: issues.filter((i) => i.severity === "info").length,
    },
    scope,
    parseWarnings: ruleWarnings,
  };
}
