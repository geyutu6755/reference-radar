/**
 * PDF report export — real implementation in Phase E (pdf-lib + CJK font).
 * Placeholder that makes the workbench import resolvable during Phase D.
 */
import type { AnalysisResult } from "../core/types";
import type { Locale } from "../i18n";

export async function exportPdfReport(_result: AnalysisResult, _fileName: string, _locale: Locale): Promise<void> {
  throw new Error("PDF export lands in the next build. / PDF 导出将在后续构建中提供。");
}
