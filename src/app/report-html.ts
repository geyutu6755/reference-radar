/**
 * Standalone HTML report generation. All dynamic content is escaped; the file
 * opens independently in any browser and carries the full findings + scope.
 */
import type { AnalysisResult, Issue, Severity } from "../core/types";
import type { Locale } from "../i18n";

const SEVERITY_LABEL: Record<Severity, { zh: string; en: string }> = {
  error: { zh: "错误", en: "Error" },
  warning: { zh: "警告", en: "Warning" },
  review: { zh: "待复核", en: "Review" },
  info: { zh: "提示", en: "Info" },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function issueHtml(issue: Issue, locale: Locale): string {
  const label = SEVERITY_LABEL[issue.severity][locale === "zh-CN" ? "zh" : "en"];
  const basis =
    locale === "zh-CN"
      ? `依据：GB/T 7714—${issue.standardVersion} 第 ${issue.source.clause} 条 — ${esc(issue.source.summary)}`
      : `Basis: GB/T 7714—${issue.standardVersion} clause ${issue.source.clause} — ${esc(issue.source.summary)}`;
  const location = issue.anchors[0]
    ? locale === "zh-CN"
      ? `位置：块 ${issue.anchors[0].blockIndex + 1} · “${esc(issue.anchors[0].text)}”`
      : `Location: block ${issue.anchors[0].blockIndex + 1} · "${esc(issue.anchors[0].text)}"`
    : "";
  const suggestion = issue.suggestion
    ? `<p class="sug">${locale === "zh-CN" ? "建议" : "Fix"}: ${esc(issue.suggestion)}</p>`
    : "";
  const manual = issue.requiresManualCheck
    ? `<p class="manual">${locale === "zh-CN" ? "⚠ 需要人工确认" : "⚠ Manual confirmation required"}</p>`
    : "";
  return `<article class="issue sev-${issue.severity}">
    <header><span class="badge">${label}</span><span class="rule">${esc(issue.ruleId)}</span></header>
    <p class="detail">${esc(issue.detail)}</p>
    ${location ? `<p class="loc">${location}</p>` : ""}
    ${suggestion}${manual}
    <p class="basis">${basis}</p>
  </article>`;
}

export function buildHtmlReport(result: AnalysisResult, fileName: string, locale: Locale): string {
  const zh = locale === "zh-CN";
  const stats = result.stats;
  const langAttr = zh ? "zh-CN" : "en";
  const scopeItems = [...result.scope.excludedNotes, ...result.parseWarnings].map((s) => `<li>${esc(s)}</li>`).join("");
  const title = zh ? "Reference Radar 检查报告" : "Reference Radar Check Report";
  const refList = result.references
    .map(
      (r) =>
        `<li><b>[${r.index}]</b> ${esc(r.raw)}</li>`
    )
    .join("");

  return `<!doctype html>
<html lang="${langAttr}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fileName)} · ${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
         margin: 0 auto; max-width: 860px; padding: 32px 20px 80px; line-height: 1.7;
         color: #182135; background: #f6f7fa; }
  h1 { font-size: 24px; } h2 { font-size: 18px; margin-top: 36px; border-bottom: 1px solid #dfe3ec; padding-bottom: 6px; }
  .meta { color: #5b6577; font-size: 14px; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
  .stat { background: #fff; border: 1px solid #e2e6ee; border-radius: 10px; padding: 10px 16px; font-size: 14px; }
  .stat b { font-size: 20px; display: block; font-variant-numeric: tabular-nums; }
  .issue { background: #fff; border: 1px solid #e2e6ee; border-radius: 10px; padding: 14px 16px; margin: 10px 0; }
  .issue header { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
  .badge { font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px; }
  .sev-error .badge { background: #fdeeee; color: #c93a3a; }
  .sev-warning .badge { background: #fdf3e4; color: #a3660f; }
  .sev-review .badge { background: #f3edfd; color: #8a5bd0; }
  .sev-info .badge { background: #eef3fb; color: #5b6577; }
  .rule { font-family: ui-monospace, monospace; font-size: 12px; color: #5b6577; }
  .detail { margin: 4px 0; } .loc, .basis { color: #5b6577; font-size: 12.5px; margin: 4px 0; }
  .sug { color: #177a48; font-size: 13.5px; } .manual { color: #8a5bd0; font-size: 12.5px; font-weight: 600; }
  ol.refs li { margin: 6px 0; font-size: 13.5px; }
  ul.scope li { color: #5b6577; font-size: 13.5px; }
  footer { margin-top: 48px; color: #5b6577; font-size: 12.5px; border-top: 1px solid #dfe3ec; padding-top: 14px; }
  @media print { body { background: #fff; } .issue { break-inside: avoid; } }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="meta">
  ${zh ? "文件" : "File"}: ${esc(fileName)}<br>
  ${zh ? "检查时间" : "Checked at"}: ${esc(new Date(result.analyzedAt).toLocaleString())}<br>
  ${zh ? "标准版本" : "Standard"}: GB/T 7714—${result.version}${result.version === "2025" ? (zh ? "（现行）" : " (current)") : ""}
</p>

<div class="stats">
  <div class="stat"><b>${stats.citationMarkerCount}</b>${zh ? "引用标记" : "Citations"}</div>
  <div class="stat"><b>${stats.referenceCount}</b>${zh ? "文献条目" : "Entries"}</div>
  <div class="stat"><b>${stats.errorCount}</b>${zh ? "错误" : "Errors"}</div>
  <div class="stat"><b>${stats.warningCount}</b>${zh ? "警告" : "Warnings"}</div>
  <div class="stat"><b>${stats.reviewCount}</b>${zh ? "待复核" : "Review"}</div>
  <div class="stat"><b>${stats.infoCount}</b>${zh ? "提示" : "Info"}</div>
</div>

<h2>${zh ? "检查结果" : "Findings"}</h2>
${result.issues.length === 0 ? `<p class="meta">${zh ? "未发现问题。" : "No findings."}</p>` : result.issues.map((i) => issueHtml(i, locale)).join("")}

<h2>${zh ? "参考文献表" : "Reference list"}</h2>
${result.references.length === 0 ? `<p class="meta">${zh ? "未检出参考文献列表。" : "No reference list detected."}</p>` : `<ol class="refs">${refList}</ol>`}

<h2>${zh ? "分析范围" : "Analysis scope"}</h2>
<ul class="scope">${scopeItems}</ul>
<p class="meta">${zh
    ? "本报告仅覆盖顺序编码制的可核查规则子集，不构成 GB/T 7714 全部条款的合规认证。"
    : "This report covers a subset of checkable rules of the numeric citation system; it is not a full GB/T 7714 compliance certification."}</p>

<footer>Generated by Reference Radar · ${esc(new Date().toISOString())} · local-first, offline-capable</footer>
</body>
</html>`;
}

export function downloadHtmlReport(result: AnalysisResult, fileName: string, locale: Locale): void {
  const html = buildHtmlReport(result, fileName, locale);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = fileName.replace(/\.docx$/i, "");
  a.href = url;
  a.download = `${base}-引文雷达报告-report.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
