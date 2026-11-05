/**
 * Real PDF report generation (pdf-lib + fontkit + bundled CJK subset font).
 * Produces a downloadable PDF with selectable text, heading structure and
 * CJK support. The font file is fetched lazily on first export only.
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { AnalysisResult, Severity } from "../core/types";
import type { Locale } from "../i18n";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLORS = {
  text: rgb(0.09, 0.13, 0.21),
  muted: rgb(0.36, 0.4, 0.47),
  primary: rgb(0.05, 0.37, 0.85),
  error: rgb(0.79, 0.23, 0.23),
  warning: rgb(0.64, 0.4, 0.06),
  review: rgb(0.54, 0.36, 0.82),
  info: rgb(0.36, 0.4, 0.47),
  line: rgb(0.85, 0.88, 0.93),
};

const SEV_COLOR: Record<Severity, keyof typeof COLORS> = {
  error: "error",
  warning: "warning",
  review: "review",
  info: "info",
};

type PDFFont = Awaited<ReturnType<PDFDocument["embedFont"]>>;
type PDFPage = Awaited<ReturnType<PDFDocument["addPage"]>>;

interface Ctx {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage | null;
  y: number;
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function ensure(ctx: Ctx, needed: number): void {
  if (!ctx.page || ctx.y - needed < MARGIN) newPage(ctx);
}

/** Draw text with CJK-aware wrapping. */
function drawText(
  ctx: Ctx,
  text: string,
  opts: { size: number; color?: ReturnType<typeof rgb>; bold?: boolean; indent?: number; lineGap?: number }
): void {
  const font = opts.bold ? ctx.bold : ctx.font;
  const indent = opts.indent ?? 0;
  const lines = wrap(sanitize(text), font, opts.size, CONTENT_W - indent);
  for (const line of lines) {
    ensure(ctx, opts.size + 6);
    ctx.page!.drawText(line, {
      x: MARGIN + indent,
      y: ctx.y - opts.size,
      size: opts.size,
      font,
      color: opts.color ?? COLORS.text,
    });
    ctx.y -= opts.size + (opts.lineGap ?? 4);
  }
}

/** Exported for tests. */
export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of text) {
    const candidate = line + ch;
    if (line.length > 0 && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      if (ch === " ") {
        out.push(line);
        line = "";
      } else if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)) {
        out.push(line);
        line = ch;
      } else {
        const lastSpace = line.lastIndexOf(" ");
        if (lastSpace > 0) {
          out.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace + 1) + ch;
        } else {
          out.push(line);
          line = ch;
        }
      }
    } else {
      line = candidate;
    }
  }
  if (line.length > 0) out.push(line);
  return out.length > 0 ? out : [""];
}

function sanitize(s: string): string {
  // eslint-disable-next-line no-control-regex -- strip control chars before PDF draw
  return s.replace(/[\u0000-\u001f]/g, " ").replace(/[^\u0000-\uFFFF]/g, "□");
}

export async function buildPdfReport(result: AnalysisResult, fileName: string, locale: Locale): Promise<Uint8Array> {
  const zh = locale === "zh-CN";
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await fetchFont();
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const bold = font; // same face; headings differ by size/color
  const helv = await pdf.embedFont(StandardFonts.Helvetica);

  const ctx: Ctx = { pdf, font, bold, page: null, y: 0 };

  newPage(ctx);
  drawText(ctx, zh ? "Reference Radar 检查报告" : "Reference Radar Check Report", {
    size: 20,
    bold: true,
    color: COLORS.primary,
    lineGap: 10,
  });
  drawText(ctx, `${zh ? "文件" : "File"}: ${fileName}`, { size: 10, color: COLORS.muted });
  drawText(ctx, `${zh ? "检查时间" : "Checked at"}: ${new Date(result.analyzedAt).toLocaleString()}`, {
    size: 10,
    color: COLORS.muted,
  });
  drawText(ctx, `GB/T 7714—${result.version}${result.version === "2025" ? (zh ? "（现行）" : " (current)") : ""}`, {
    size: 10,
    color: COLORS.muted,
    lineGap: 14,
  });

  const s = result.stats;
  const statsRows: Array<[string, number]> = [
    [zh ? "引用标记" : "Citations", s.citationMarkerCount],
    [zh ? "文献条目" : "Entries", s.referenceCount],
    [zh ? "错误" : "Errors", s.errorCount],
    [zh ? "警告" : "Warnings", s.warningCount],
    [zh ? "待复核" : "Review", s.reviewCount],
    [zh ? "提示" : "Info", s.infoCount],
  ];
  ensure(ctx, 80);
  const colW = CONTENT_W / 3;
  statsRows.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MARGIN + col * colW;
    const y = ctx.y - row * 34;
    ctx.page!.drawRectangle({ x: x - 4, y: y - 26, width: colW - 8, height: 30, color: rgb(0.96, 0.97, 0.985) });
    ctx.page!.drawText(String(value), { x, y: y - 10, size: 13, font: ctx.bold, color: COLORS.text });
    ctx.page!.drawText(sanitize(label), { x, y: y - 23, size: 8.5, font: ctx.font, color: COLORS.muted });
  });
  ctx.y -= 2 * 34 + 12;

  drawHeading(ctx, zh ? "一、检查结果" : "1. Findings");
  if (result.issues.length === 0) {
    drawText(ctx, zh ? "未发现确定性问题。" : "No findings.", { size: 10, color: COLORS.muted });
  }
  for (const issue of result.issues) {
    ensure(ctx, 70);
    const sev = SEV_COLOR[issue.severity];
    drawText(ctx, `${sevLabel(issue.severity, zh)} · ${issue.ruleId}`, {
      size: 9.5,
      bold: true,
      color: COLORS[sev],
      lineGap: 2,
    });
    drawText(ctx, issue.detail, { size: 10, lineGap: 2 });
    if (issue.anchors[0]) {
      drawText(
        ctx,
        `${zh ? "位置" : "Location"}: ${zh ? "块" : "block"} ${issue.anchors[0].blockIndex + 1} · "${issue.anchors[0].text}"`,
        { size: 8.5, color: COLORS.muted, indent: 8 }
      );
    }
    if (issue.suggestion) {
      drawText(ctx, `${zh ? "建议" : "Fix"}: ${issue.suggestion}`, { size: 9, indent: 8 });
    }
    drawText(
      ctx,
      `${zh ? "依据" : "Basis"}: GB/T 7714—${issue.standardVersion} ${zh ? "第" : "clause"} ${issue.source.clause} — ${issue.source.summary}`,
      { size: 8.5, color: COLORS.muted, indent: 8 }
    );
    ctx.y -= 6;
  }

  drawHeading(ctx, zh ? "二、参考文献表" : "2. Reference list");
  if (result.references.length === 0) {
    drawText(ctx, zh ? "未检出参考文献列表。" : "No reference list detected.", { size: 10, color: COLORS.muted });
  } else {
    for (const r of result.references) {
      ensure(ctx, 26);
      drawText(ctx, `[${r.index}] ${r.raw}`, { size: 9.5, indent: 8, lineGap: 3 });
    }
  }

  drawHeading(ctx, zh ? "三、分析范围与说明" : "3. Analysis scope");
  for (const note of result.scope.excludedNotes) drawText(ctx, `• ${note}`, { size: 9, color: COLORS.muted });
  for (const w of result.parseWarnings) drawText(ctx, `• ${w}`, { size: 9, color: COLORS.muted });
  drawText(
    ctx,
    zh
      ? "本报告仅覆盖顺序编码制的可核查规则子集，不构成 GB/T 7714 全部条款的合规认证。"
      : "This report covers a subset of checkable rules of the numeric citation system; it is not a full GB/T 7714 compliance certification.",
    { size: 8.5, color: COLORS.muted }
  );

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${i + 1} / ${pages.length}`, { x: PAGE_W - MARGIN - 40, y: 28, size: 8.5, font: helv, color: COLORS.muted });
    p.drawText("Reference Radar", { x: MARGIN, y: 28, size: 8.5, font: helv, color: COLORS.muted });
  });

  return pdf.save();
}

function sevLabel(sev: Severity, zh: boolean): string {
  const map: Record<Severity, [string, string]> = {
    error: ["错误", "ERROR"],
    warning: ["警告", "WARN"],
    review: ["待复核", "REVIEW"],
    info: ["提示", "INFO"],
  };
  return map[sev][zh ? 0 : 1];
}

function drawHeading(ctx: Ctx, text: string): void {
  ensure(ctx, 40);
  ctx.y -= 10;
  drawText(ctx, text, { size: 13, bold: true, lineGap: 6 });
  ensure(ctx, 10);
  ctx.page!.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.7,
    color: COLORS.line,
  });
  ctx.y -= 10;
}

let fontCache: ArrayBuffer | null = null;
async function fetchFont(): Promise<Uint8Array> {
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base}fonts/NotoSansSC-Subset.otf`.replace(/([^:]\/)\/+/g, "$1");
  if (!fontCache) {
    // 1) normal network fetch (first export online, HTTP cache helps);
    // 2) offline: the service worker should answer from a cache — but if the
    //    page is not controlled by a SW (failed install under a flaky network)
    //    or the SW misses, fall back to searching EVERY Cache API entry. This
    //    is what the production offline-export failure traced back to (V1.1.2).
    let res: Response | undefined;
    try {
      const r = await fetch(url);
      if (r.ok) res = r;
    } catch {
      /* offline or uncontrolled — fall through to cache lookup */
    }
    if (!res) {
      try {
        res = (await caches.match(url)) ?? undefined;
      } catch {
        /* Cache API unavailable — nothing more we can do */
      }
    }
    if (!res) {
      throw new Error(
        "无法获取中文字体（离线且本地缓存中不存在）。请联网导出一次以缓存字体，或改用 HTML 报告。 " +
          "/ Could not load the CJK font (offline and not cached). Export once while online, or use the HTML report."
      );
    }
    fontCache = await res.arrayBuffer();
  }
  return new Uint8Array(fontCache);
}

/** Shape of this module for consumers that preload it lazily. */
export interface PdfModule {
  buildPdfReport: typeof buildPdfReport;
  exportPdfReport: typeof exportPdfReport;
}

export async function exportPdfReport(result: AnalysisResult, fileName: string, locale: Locale): Promise<void> {
  const bytes = await buildPdfReport(result, fileName, locale);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = fileName.replace(/\.docx$/i, "");
  a.href = url;
  a.download = `${base}-引文雷达报告-report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
