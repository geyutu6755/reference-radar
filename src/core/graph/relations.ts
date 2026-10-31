/**
 * Citation ↔ reference relation building.
 */
import type { Citation, ReferenceEntry, Relation } from "../types";

export function buildRelations(citations: Citation[], references: ReferenceEntry[]): Relation[] {
  const byIndex = new Map<number, ReferenceEntry>();
  for (const r of references) byIndex.set(r.index, r);

  const relations: Relation[] = [];
  for (const c of citations) {
    for (const n of c.numbers) {
      const ref = byIndex.get(n);
      relations.push({
        citationId: c.id,
        referenceId: ref?.id ?? `missing-${n}`,
        number: n,
        missing: !ref,
      });
    }
  }
  return relations;
}
