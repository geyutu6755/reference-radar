/**
 * REAL-document compatibility validation (v1.0.2) — recorded study, not a CI gate.
 *
 * Samples are real DOCX files from public official sources, kept OUT of the
 * repository (licensing) in _research/real-docx/. This test skips silently
 * when the files are absent (CI) and runs the full comparison locally.
 * Annotations hand-derived from the extracted document text before running.
 * Results recorded in docs/real-docx-validation.md.
 *
 * Sources & usage conditions:
 *  R-01 北京航空航天大学教务处《北航本科生毕业设计（论文）word模板（2026-2027学年）》
 *       https://jiaowu.buaa.edu.cn/info/1025/2101.htm — official public download for students; used locally as compatibility input, not redistributed.
 *  R-02 中国人民大学教务处《本科毕业论文模板》
 *       http://jiaowu.ruc.edu.cn/jsym/sjjx/wjxzsj/51e69d201bca44c7b91f494f8daaa6a9.htm — official public download; not redistributed.
 *  R-03 GB/T 7714—2025 standard DOCX transcription
 *       https://github.com/RunawayOrange/GB_T_7714-2025 — community transcription of the standard text.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeDocx } from "../pipeline";
import type { StandardVersion } from "../types";

const DIR = join(process.cwd(), "_research", "real-docx");

interface RealExpect {
  markers?: string[];
  references?: number[];
  errors?: Record<string, number>;
  warnings?: Record<string, number>;
  infos?: Record<string, number>;
  reviewsAtLeast?: number;
  refsDetected?: boolean;
  minBlocks?: number;
}

interface RealSample {
  id: string;
  file: string;
  versions: StandardVersion[];
  expect: Partial<Record<StandardVersion, RealExpect>> & { default?: RealExpect };
}

const SAMPLES: RealSample[] = [
  {
    id: "R-01",
    file: "BUAA-template.docx",
    versions: ["2025", "2015"],
    expect: {
      "2025": {
        markers: ["[2]", "[3, 6-9]"],
        references: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        errors: { "RR-CIT-004": 1 },
        warnings: {},
        infos: { "RR-REF-011": 9 },
        refsDetected: true,
      },
      "2015": {
        markers: ["[2]", "[3, 6-9]"],
        references: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        errors: { "RR-CIT-004": 1 },
        warnings: { "RR-FMT-008": 2 },
        infos: { "RR-REF-011": 9 },
        reviewsAtLeast: 4, // 2015 电子资源统一要求引用日期 → P/R/D/S-OL 四条待复核
        refsDetected: true,
      },
    },
  },
  {
    id: "R-02",
    file: "RUC-本科毕业论文模板.docx",
    versions: ["2025", "2015"],
    expect: {
      default: {
        markers: [],
        references: [1, 2, 3, 4, 5, 6],
        errors: {},
        warnings: {},
        infos: { "RR-REF-011": 6 },
        refsDetected: true,
      },
    },
  },
  {
    id: "R-03",
    file: "gbt7714-2025-standard.docx",
    versions: ["2025"],
    expect: {
      default: { minBlocks: 150 },
    },
  },
];

describe("real-document compatibility (skipped when sample files absent)", () => {
  const metrics = { tp: 0, fp: 0, fn: 0, det: 0, rows: [] as string[], failures: 0 };

  for (const sample of SAMPLES) {
    const path = join(DIR, sample.file);
    const present = existsSync(path);
    it(`${sample.id} ${sample.file}`, () => {
      if (!present) return; // files intentionally not committed — CI skips

      const bytes = readFileSync(path);
      for (const version of sample.versions) {
        const exp = sample.expect[version] ?? sample.expect.default!;
        const r = analyzeDocx(bytes, sample.file, { version });
        const markers = r.citations.map((c) => c.raw);
        const refs = r.references.map((x) => x.index);
        const issues = (sev: string) => r.issues.filter((i) => i.severity === sev).map((i) => i.ruleId);
        let line = `${sample.id}/${version}: blocks=${r.stats.blockCount}`;

        if (exp.markers !== undefined) {
          const wantMarkers = exp.markers ?? [];
          const set = new Set(markers);
          const hit = wantMarkers.filter((m) => set.has(m)).length;
          metrics.tp += hit;
          metrics.fn += wantMarkers.length - hit;
          metrics.det += markers.length;
          const extra = markers.filter((m) => !wantMarkers.includes(m));
          metrics.fp += extra.length;
          line += ` | markers ${hit}/${exp.markers.length} extra=[${extra.join(",")}]`;
          expect(extra, `${sample.id} unexpected detections`).toEqual([]);
        }
        if (exp.references !== undefined) {
          expect(refs, `${sample.id} reference numbers`).toEqual(exp.references);
        }
        for (const [sev, expected] of [
          ["error", exp.errors],
          ["warning", exp.warnings],
          ["info", exp.infos],
        ] as const) {
          if (expected === undefined) continue;
          const actual = issues(sev);
          const got = actual.reduce<Record<string, number>>((m, rid) => ({ ...m, [rid]: (m[rid] ?? 0) + 1 }), {});
          const want = Object.fromEntries(Object.entries(expected).filter(([, n]) => n > 0));
          expect(got, `${sample.id} ${sev} issues`).toEqual(want);
          line += ` | ${sev} OK`;
        }
        if (exp.reviewsAtLeast !== undefined) {
          const n = r.issues.filter((i) => i.severity === "review").length;
          expect(n, `${sample.id} reviews`).toBeGreaterThanOrEqual(exp.reviewsAtLeast);
        }
        if (exp.refsDetected !== undefined) {
          expect(r.scope.referenceSectionDetected, `${sample.id} ref section`).toBe(exp.refsDetected);
        }
        if (exp.minBlocks !== undefined) {
          expect(r.stats.blockCount, `${sample.id} blocks`).toBeGreaterThanOrEqual(exp.minBlocks);
        }
        metrics.rows.push(line);
      }
    });
  }

  it("summary", () => {
     
    console.warn(
      `[real-docx] marker recall=${(metrics.tp / Math.max(1, metrics.tp + metrics.fn)).toFixed(3)} precision=${(metrics.tp / Math.max(1, metrics.det)).toFixed(3)}\n${metrics.rows.join("\n")}`
    );
  });
});
