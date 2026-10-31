/**
 * End-to-end analysis pipeline: DOCX bytes → AnalysisResult.
 * Runs without DOM access so it can execute inside a Web Worker.
 */
import { loadDocx } from "./docx/load";
import { extractCitations } from "./extract/citations";
import { applyReferenceRegion, detectReferenceSection } from "./references/detect";
import { parseReferenceEntries } from "./references/parse";
import { buildRelations } from "./graph/relations";
import { runRules } from "./rules/engine";
import type { AnalysisResult, AnalysisScope, ContainerKind, StandardVersion } from "./types";

export interface AnalyzeOptions {
  version: StandardVersion;
}

export function analyzeDocx(bytes: Uint8Array, fileName: string, options: AnalyzeOptions): AnalysisResult {
  const version = options.version;
  const parseWarnings: string[] = [];

  const loaded = loadDocx(bytes); // loader errors are user-facing — propagate
  parseWarnings.push(...loaded.warnings);

  const blocks = loaded.blocks;

  // ---- scope determination ----
  const section = detectReferenceSection(blocks);
  if (section) applyReferenceRegion(blocks, section);

  const analyzedContainers = new Set<ContainerKind>(["body", "table-cell"]);
  if (loaded.parts.footnotes) analyzedContainers.add("footnote");
  if (loaded.parts.endnotes) analyzedContainers.add("endnote");

  const excludedNotes: string[] = [];
  if (!loaded.parts.footnotes && !loaded.parts.endnotes) {
    excludedNotes.push("文档未包含脚注/尾注部件 / The document has no footnote or endnote parts.");
  } else {
    excludedNotes.push(
      "脚注与尾注中的编号式引用已提取；脚注型文献表（页下注文献表）暂不参与编号一致性核查，请在报告中查看“分析范围”。" +
        " / Numbered citations in footnotes/endnotes are extracted; footnote-based reference lists are not yet checked for list consistency — see the analysis scope."
    );
  }
  excludedNotes.push("页眉、页脚与文本框内容未纳入检查 / Headers, footers and text boxes are not checked.");
  excludedNotes.push(
    "Word 域与文献管理器（Zotero/Mendeley/EndNote）生成的引用按其显示文本分析，未解析其元数据代码。" +
      " / Field-based citations (Zotero/Mendeley/EndNote) are analyzed by their displayed text; field metadata is not parsed."
  );

  // ---- citations & references ----
  const { citations, entryLike } = extractCitations(blocks);
  if (entryLike.length >= 2 && !section) {
    parseWarnings.push(
      "未找到参考文献标题，但检测到疑似文献条目段落；已按条目列表解析。 / No reference heading found; entry-like paragraphs were parsed as a reference list."
    );
  }
  let references = section
    ? parseReferenceEntries(blocks, section.startIndex + 1, section.endIndex).entries
    : [];
  if (references.length === 0 && !section && entryLike.length >= 2) {
    const first = entryLike[0]!;
    references = parseReferenceEntries(blocks, first, blocks.length - 1).entries;
  }

  const relations = buildRelations(citations, references);

  const scope: AnalysisScope = {
    analyzedContainers: [...analyzedContainers],
    excludedNotes,
    referenceSectionDetected: !!section,
    referenceSectionTitle: section?.title,
  };

  // ---- rules ----
  const issues = runRules({ version, citations, references, relations, blocks, notes: [], scope });

  const stats = {
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
  };

  return {
    fileName,
    analyzedAt: new Date().toISOString(),
    version,
    blocks,
    citations,
    references,
    relations,
    issues,
    stats,
    scope,
    parseWarnings,
  };
}
