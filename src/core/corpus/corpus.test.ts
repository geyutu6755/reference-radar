/**
 * External corpus validation.
 *
 * The corpus in /corpus is built by an INDEPENDENT generator (corpus/build.mjs,
 * no imports from src/) and annotated by hand BEFORE running the engine
 * (corpus/annotations/*.json). This runner measures, per sample and in
 * aggregate:
 *
 *  - marker recall  = annotated markers found / annotated markers
 *  - marker precision = detections matching annotations / detections
 *  - issue TP / FP / FN against the hand-annotated ruleId multisets
 *    (errors, warnings, infos; reviews measured as "at least N")
 *
 * The metrics are asserted (no unexpected deterministic FPs, marker recall 100%,
 * issue mismatches zero) so regressions fail the suite; the full metric table
 * is printed for docs/external-validation.md.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyzeDocx } from "../pipeline";
import type { StandardVersion } from "../types";

const ROOT = join(import.meta.dirname ?? process.cwd(), "../../..");
const FILES = join(ROOT, "corpus", "files");
const ANNOT = join(ROOT, "corpus", "annotations");

interface VersionExpect {
  markers: string[];
  references: number[];
  errors: Record<string, number>;
  warnings: Record<string, number>;
  infos: Record<string, number>;
  reviewsAtLeast: number;
  referenceSectionDetected: boolean;
  missingRelations: number;
}

interface Annotation {
  id: string;
  title: string;
  /** Optional per-version expectations; when absent, `expect` applies to all. */
  versions?: Record<string, VersionExpect>;
  expect: {
    markers: string[];
    references: number[];
    errors: Record<string, number>;
    warnings: Record<string, number>;
    infos: Record<string, number>;
    reviewsAtLeast: number;
    referenceSectionDetected: boolean;
    missingRelations: number;
  };
  note?: string;
}

function loadAnnotations(): Annotation[] {
  return readdirSync(ANNOT)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(ANNOT, f), "utf-8")) as Annotation)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function multisetDiff(expected: Record<string, number>, actual: string[]): { tp: number; fp: number; fn: number } {
  const want: Record<string, number> = { ...expected };
  let tp = 0;
  for (const rid of actual) {
    if ((want[rid] ?? 0) > 0) {
      want[rid]!--;
      tp++;
    }
  }
  const remaining = Object.values(want).reduce((a, b) => a + b, 0);
  return { tp, fp: actual.length - tp, fn: remaining };
}

const rows: string[] = [];
const agg = { markerTP: 0, markerFN: 0, detTotal: 0, errTP: 0, errFP: 0, errFN: 0, warnTP: 0, warnFP: 0, warnFN: 0, infoTP: 0, infoFP: 0, infoFN: 0, samples: 0 };

describe("external corpus validation (independent annotations)", () => {
  for (const a of loadAnnotations()) {
    it(`${a.id} ${a.title}`, () => {
      const bytes = readFileSync(join(FILES, `${a.id}.docx`));
      const versions: StandardVersion[] = a.versions ? (Object.keys(a.versions) as StandardVersion[]) : ["2025"];

      for (const version of versions) {
        const exp: Annotation["expect"] = a.versions?.[version] ?? a.expect;
        let actualMarkers: string[] = [];
        let actualRefNums: number[] = [];
        let actualErrors: string[] = [];
        let actualWarnings: string[] = [];
        let actualInfos: string[] = [];
        let actualReviews = 0;
        let refSection = false;
        let missing = 0;
        let thrown = "";

        try {
          const r = analyzeDocx(bytes, `${a.id}.docx`, { version });
          actualMarkers = r.citations.map((c) => c.raw);
          actualRefNums = r.references.map((x) => x.index);
          actualErrors = r.issues.filter((i) => i.severity === "error").map((i) => i.ruleId);
          actualWarnings = r.issues.filter((i) => i.severity === "warning").map((i) => i.ruleId);
          actualInfos = r.issues.filter((i) => i.severity === "info").map((i) => i.ruleId);
          actualReviews = r.issues.filter((i) => i.severity === "review").length;
          refSection = r.scope.referenceSectionDetected;
          missing = r.relations.filter((x) => x.missing).length;
        } catch (e) {
          thrown = (e as Error & { code?: string }).code ?? (e as Error).message;
        }

        // ---- thrown-expectation samples (C15) ----
        if (a.note?.startsWith("thrown:") && !(version in (a.versions ?? {}))) {
          const wantCode = a.note.split("thrown:")[1]!.trim();
          expect(thrown).toBe(wantCode);
          rows.push(`${a.id}/${version} | thrown ${wantCode} as annotated | OK`);
          agg.samples++;
          continue;
        }

        // ---- markers ----
        const markerSet = new Set(actualMarkers);
        const markerTP = exp.markers.filter((m) => markerSet.has(m)).length;
        const markerFN = exp.markers.length - markerTP;
        const extraDetections = actualMarkers.filter((m) => !exp.markers.includes(m));
        agg.markerTP += markerTP;
        agg.markerFN += markerFN;
        agg.detTotal += actualMarkers.length;

        // ---- references ----
        expect(actualRefNums, `${a.id}/${version} refs`).toEqual(exp.references);
        expect(refSection, `${a.id}/${version} ref section`).toBe(exp.referenceSectionDetected);
        if (exp.missingRelations > 0) {
          expect(missing, `${a.id}/${version} missing relations`).toBe(exp.missingRelations);
        }

        // ---- issues ----
        const err = multisetDiff(exp.errors, actualErrors);
        const warn = multisetDiff(exp.warnings, actualWarnings);
        const info = multisetDiff(exp.infos, actualInfos);
        agg.errTP += err.tp; agg.errFP += err.fp; agg.errFN += err.fn;
        agg.warnTP += warn.tp; agg.warnFP += warn.fp; agg.warnFN += warn.fn;
        agg.infoTP += info.tp; agg.infoFP += info.fp; agg.infoFN += info.fn;
        agg.samples++;

        expect(err.fp, `${a.id}/${version} unexpected error FPs: ${actualErrors.join(",")}`).toBe(0);
        expect(err.fn, `${a.id}/${version} missed errors: want ${JSON.stringify(a.expect.errors)} got ${actualErrors.join(",")}`).toBe(0);
        expect(warn.fp + warn.fn, `${a.id}/${version} warning mismatch: want ${JSON.stringify(a.expect.warnings)} got ${actualWarnings.join(",")}`).toBe(0);
        expect(info.fp + info.fn, `${a.id}/${version} info mismatch: want ${JSON.stringify(a.expect.infos)} got ${actualInfos.join(",")}`).toBe(0);
        expect(actualReviews, `${a.id}/${version} reviews >= ${exp.reviewsAtLeast}`).toBeGreaterThanOrEqual(exp.reviewsAtLeast);

        rows.push(
          `${a.id}/${version} | markers ${markerTP}/${exp.markers.length} recall (extra detect: ${extraDetections.length})` +
            ` | err TP${err.tp}/FP${err.fp}/FN${err.fn} | warn TP${warn.tp}/FP${warn.fp}/FN${warn.fn}` +
            ` | info TP${info.tp}/FP${info.fp}/FN${info.fn} | reviews ${actualReviews} | OK`
        );
      }
    });
  }

  it("aggregate metrics (printed for external-validation doc)", () => {
    // Hard gates on aggregate quality
    expect(agg.markerFN).toBe(0); // every annotated marker must be found
    expect(agg.errFP).toBe(0); // no unexpected deterministic errors anywhere
    expect(agg.errFN).toBe(0);
    expect(agg.warnFP + agg.warnFN).toBe(0);
    expect(agg.infoFP + agg.infoFN).toBe(0);

    const markerRecall = agg.markerTP / Math.max(1, agg.markerTP + agg.markerFN);
    const markerPrecision = agg.markerTP / Math.max(1, agg.detTotal);
     
    console.warn(
      `[corpus] samples=${agg.samples} markerRecall=${markerRecall.toFixed(3)} markerPrecision=${markerPrecision.toFixed(3)} ` +
        `errTP=${agg.errTP} FP=${agg.errFP} FN=${agg.errFN} warnTP=${agg.warnTP} FP=${agg.warnFP} FN=${agg.warnFN} ` +
        `infoTP=${agg.infoTP} FP=${agg.infoFP} FN=${agg.infoFN}`
    );
     
    console.warn(`[corpus]\n${rows.join("\n")}`);
  });
});
