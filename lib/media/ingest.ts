import type { SpeakerAssignment } from "@/lib/types";

// Greedy batches whose JSON length stays <= maxBytes (an oversized single item gets its own batch).
export function batchBySize<T>(items: T[], maxBytes: number): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let size = 2;
  for (const it of items) {
    const n = JSON.stringify(it).length + 1;
    if (cur.length && size + n > maxBytes) {
      out.push(cur);
      cur = [];
      size = 2;
    }
    cur.push(it);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

export const candidateKey = (a: Pick<SpeakerAssignment, "label" | "name" | "evidenceTurnKey">) => `${a.label}|${a.name}|${a.evidenceTurnKey}`;

// Ruling 17: reuse a stored verdict unless --reconfirm.
export const reuseOrCall = (key: string, stored: Map<string, unknown>, reconfirm: boolean): "reuse" | "call" =>
  !reconfirm && stored.has(key) ? "reuse" : "call";

export function labelOrder(turns: { label: string | null }[]): string[] {
  const seen = new Set<string>();
  for (const t of turns) if (t.label) seen.add(t.label);
  return [...seen];
}
