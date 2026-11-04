/**
 * Per-type 著录项目 necessity facts used by the entry-format rules.
 *
 * Only element names, their 必备性 value and the clause/table that carries them
 * are recorded here — these are bibliographic facts, not the standard's prose.
 * The full text of GB/T 7714—2025 is copyrighted and is deliberately NOT
 * redistributed in this repository (see docs/verification.md).
 *
 * Every row below was read from the official 45-page scan (PDF pages 13–28) and
 * cross-checked against the 著录格式 examples of the same clause.
 * Verified 2026-11-01 during the V1.1.1 rule audit.
 */
import type { StandardVersion } from "../types";

export type Necessity =
  /** 必备 — always required for this type. */
  | "required"
  /** 电子资源必备 — required when the entry is an electronic resource. */
  | "electronic-required"
  /** 有则必备 — required when the information exists; absence is not a violation. */
  | "if-present-required"
  /** The element is not listed for this type at all. */
  | "not-an-element";

export interface ElementRequirement {
  necessity: Necessity;
  /** Clause of GB/T 7714—2025 carrying the element table. */
  clause: string;
  /** Element table reference as shown to the user, e.g. “表14”. */
  table: string;
}

export type CheckedElement = "citedDate" | "accessPath" | "degreeGrantingInstitution" | "standardNumber" | "publicationYear";

/**
 * 2025 edition. “网站” and “网页” are governed by two separate tables that both
 * make 引用日期 and 获取和访问路径 必备; an entry cannot be assigned to one of
 * them from its text, so EB cites both.
 */
const FACTS_2025: Record<CheckedElement, Record<string, ElementRequirement>> = {
  citedDate: {
    EB: { necessity: "required", clause: "8.11.2.1 表10 / 8.11.3.1 表11", table: "表10、表11" },
    DS: { necessity: "required", clause: "8.14.2 表14", table: "表14" },
    PP: { necessity: "required", clause: "8.15.1 表15", table: "表15" },
    J: { necessity: "not-an-element", clause: "8.5.2 表4", table: "表4" },
    M: { necessity: "not-an-element", clause: "8.2.1 表1", table: "表1" },
    D: { necessity: "not-an-element", clause: "8.7.1 表6", table: "表6" },
    R: { necessity: "not-an-element", clause: "8.8.2 表7", table: "表7" },
    S: { necessity: "not-an-element", clause: "8.9.1 表8", table: "表8" },
    P: { necessity: "not-an-element", clause: "8.10.1 表9", table: "表9" },
  },
  accessPath: {
    EB: { necessity: "required", clause: "8.11.2.1 表10 / 8.11.3.1 表11", table: "表10、表11" },
    PP: { necessity: "required", clause: "8.15.1 表15", table: "表15" },
    // 表14 records 获取和访问路径 as 电子资源必备, i.e. carrier-conditional.
    DS: { necessity: "electronic-required", clause: "8.14.2 表14", table: "表14" },
    D: { necessity: "electronic-required", clause: "8.7.1 表6", table: "表6" },
    J: { necessity: "electronic-required", clause: "8.5.2 表4", table: "表4" },
    S: { necessity: "electronic-required", clause: "8.9.1 表8", table: "表8" },
  },
  degreeGrantingInstitution: {
    D: { necessity: "required", clause: "8.7.1 表6", table: "表6" },
  },
  standardNumber: {
    S: { necessity: "required", clause: "8.9.1 表8", table: "表8" },
  },
  publicationYear: {
    // 年卷期/版次标识与页码等 is 有则必备 → absence cannot be a deterministic error.
    J: { necessity: "if-present-required", clause: "8.5.2 表4", table: "表4" },
  },
};

/** 2015 equivalent clause numbers for the elements the rules consult. */
const CLAUSES_2015: Partial<Record<CheckedElement, string>> = {
  citedDate: "8.4.4",
  degreeGrantingInstitution: "4.5",
  standardNumber: "4.4",
  publicationYear: "8.8",
};

export function requirementFor(
  version: StandardVersion,
  element: CheckedElement,
  typeCode: string
): ElementRequirement | undefined {
  if (version === "2015") {
    const clause = CLAUSES_2015[element];
    if (!clause) return undefined;
    // 2015 has no per-type element table reproduced here; the clause shown is
    // the verified-secondary one used by the rule since V1.0.
    return { necessity: "required", clause, table: "" };
  }
  return FACTS_2025[element]?.[typeCode];
}

/** Clause string to display on a finding, or the rule's fallback clause. */
export function basisClause(
  version: StandardVersion,
  element: CheckedElement,
  typeCode: string,
  fallback: string
): string {
  return requirementFor(version, element, typeCode)?.clause ?? fallback;
}

/**
 * A cited date is only “missing” when it is 必备 for the type. Returns false for
 * types where the element is not part of the table (表1/4/6/7/8/9 carry none).
 */
export function citedDateIsRequired(version: StandardVersion, typeCode: string): boolean {
  if (version === "2015") return true;
  return requirementFor("2025", "citedDate", typeCode)?.necessity === "required";
}

/** Access path required — carrier-conditional types resolve against 表A.2 carriers. */
export function accessPathIsRequired(version: StandardVersion, typeCode: string, carrierCode?: string): boolean {
  if (version === "2015") return false; // not implemented for 2015 (RR-FMT-014 is 2025-only)
  const fact = requirementFor("2025", "accessPath", typeCode);
  if (!fact) return false;
  if (fact.necessity === "required") return true;
  // 表A.2 lists MT/DK/CD/OL/MM — all of them are electronic-resource carriers, so a
  // declared carrier makes the element required. Without any carrier code the
  // entry does not present itself as an electronic resource and we must not guess.
  return fact.necessity === "electronic-required" && carrierCode !== undefined;
}
