/**
 * Citation ↔ reference relation building.
 *
 * V1.1.2: a citation number now links to EVERY entry carrying that number.
 * Before, duplicate numbers (already flagged by RR-REF-002) silently linked
 * only to the last entry, so the earlier duplicate appeared unconnected in the
 * graph and its relations were lost.
 */
import type { Citation, ReferenceEntry, Relation } from "../types";

export function buildRelations(citations: Citation[], references: ReferenceEntry[]): Relation[] {
  const byIndex = new Map<number, ReferenceEntry[]>();
  for (const r of references) {
    const list = byIndex.get(r.index);
    if (list) list.push(r);
    else byIndex.set(r.index, [r]);
  }

  const relations: Relation[] = [];
  for (const c of citations) {
    for (const n of c.numbers) {
      const refs = byIndex.get(n);
      if (!refs || refs.length === 0) {
        relations.push({ citationId: c.id, referenceId: `missing-${n}`, number: n, missing: true });
        continue;
      }
      for (const ref of refs) {
        relations.push({
          citationId: c.id,
          referenceId: ref.id,
          number: n,
          missing: false,
        });
      }
    }
  }
  return relations;
}
