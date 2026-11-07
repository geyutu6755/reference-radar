/**
 * Golden sample runner: pipeline output must match the hand-authored
 * expectations in samples.ts exactly.
 */
import { describe, expect, it } from "vitest";
import { analyzeDocx } from "../pipeline";
import { DocxLimitsError } from "../docx/limits";
import { GOLDEN_SAMPLES, HOSTILE_SAMPLES, type GoldenExpectation } from "./samples";

function checkExpectation(id: string, result: ReturnType<typeof analyzeDocx>, exp: GoldenExpectation) {
  const errors = result.issues.filter((i) => i.severity === "error").map((i) => i.ruleId);
  const warnings = result.issues.filter((i) => i.severity === "warning").map((i) => i.ruleId);
  const reviews = result.issues.filter((i) => i.severity === "review").map((i) => i.ruleId);
  const infos = result.issues.filter((i) => i.severity === "info");

  expect(errors, `${id} errors`).toEqual(exp.errors);
  expect(warnings, `${id} warnings`).toEqual(exp.warnings);
  for (const rid of exp.reviewsInclude ?? []) {
    expect(reviews, `${id} review ${rid}`).toContain(rid);
  }
  if (exp.maxInfos !== undefined) {
    expect(infos.length, `${id} info count`).toBeLessThanOrEqual(exp.maxInfos);
  }
  if (exp.citationMarkers !== undefined) {
    expect(result.citations.length, `${id} citationMarkers`).toBe(exp.citationMarkers);
  }
  if (exp.referenceCount !== undefined) {
    expect(result.references.length, `${id} referenceCount`).toBe(exp.referenceCount);
  }
  if (exp.missingRelations !== undefined) {
    expect(result.relations.filter((r) => r.missing).length, `${id} missingRelations`).toBe(exp.missingRelations);
  }
  if (exp.referenceSectionDetected !== undefined) {
    expect(result.scope.referenceSectionDetected, `${id} refSection`).toBe(exp.referenceSectionDetected);
  }
}

describe("golden samples (hand-authored expectations)", () => {
  for (const s of GOLDEN_SAMPLES) {
    for (const version of s.versions) {
      it(`${s.id} ${s.title} [GB/T 7714—${version}]`, () => {
        const result = analyzeDocx(s.bytes(), `${s.id}.docx`, { version });
        checkExpectation(`${s.id}/${version}`, result, s.expect[version]!);
      });
    }
  }
});

describe("hostile inputs (must fail safely with actionable codes)", () => {
  // These tests deliberately inflate large payloads to prove the caps reject
  // them — under a loaded machine the 64 MB inflate can exceed the 5 s default.
  it.each(HOSTILE_SAMPLES)("$id $title", (s) => {
      if (s.throwsCode) {
        expect(() => analyzeDocx(s.bytes(), `${s.id}.docx`, { version: "2025" })).toThrowError(
          expect.objectContaining({ code: s.throwsCode }) as Error
        );
      } else {
        // G18e: malformed XML throws a generic, readable Error (not a crash).
        expect(() => analyzeDocx(s.bytes(), `${s.id}.docx`, { version: "2025" })).toThrowError(/document\.xml/);
      }
    }, 60000);

  it("DocxLimitsError carries a user-facing code", () => {
    const e = new DocxLimitsError("zip-bomb", "test");
    expect(e.code).toBe("zip-bomb");
    expect(e.name).toBe("DocxLimitsError");
  });
});
