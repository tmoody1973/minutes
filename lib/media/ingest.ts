import type { SpeakerAssignment } from "@/lib/types";

// Greedy batches whose JSON length stays <= maxBytes and size <= maxItems (an oversized single item gets its own batch).
export function batchBySize<T>(items: T[], maxBytes: number, maxItems = Infinity): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let size = 2;
  for (const it of items) {
    const n = JSON.stringify(it).length + 1;
    if (cur.length && (size + n > maxBytes || cur.length >= maxItems)) {
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

// Stable fingerprint of the speaker names a Chapterer call saw (sorted `label=name`, FNV-1a 32-bit hex).
export function namesFingerprint(pairs: { label: string; name: string }[]): string {
  const text = pairs.map((p) => `${p.label}=${p.name}`).sort().join("\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

type StoredParts = { startMs?: number; endMs?: number; partsSource?: "model" | "none"; namesFingerprint?: string };

// Reuse stored parts only if the window and the names the model saw are unchanged and nothing forces a refresh.
export function partsDecision(a: { old: StoredParts | undefined; window: { startMs: number; endMs: number }; fingerprint: string; reconfirm: boolean; reparts: boolean }): "reuse" | "refresh" {
  const { old } = a;
  if (a.reconfirm || a.reparts || !old?.partsSource || old.namesFingerprint !== a.fingerprint) return "refresh";
  return old.startMs === a.window.startMs && old.endMs === a.window.endMs ? "reuse" : "refresh";
}

// Model outage while refreshing: keep what was stored (parts, source, fingerprint) rather than blank it.
type PartsFields = { startMs?: number; endMs?: number; parts: unknown[]; partsSource?: "model" | "none"; partsReason?: string; namesFingerprint?: string };
// Only valid for the same window: old parts pinned to a moved window would be reused forever.
export function outageRow<T extends { parts: unknown[]; startMs?: number; endMs?: number }>(bare: T, old: PartsFields | undefined): T & Partial<PartsFields> {
  if (!old?.partsSource || old.startMs !== bare.startMs || old.endMs !== bare.endMs) return bare;
  const { parts, partsSource, partsReason, namesFingerprint } = old;
  return { ...bare, parts, partsSource, ...(partsReason ? { partsReason } : {}), ...(namesFingerprint ? { namesFingerprint } : {}) };
}

// Chunk files of a transcript dir, sorted; an empty dir is an error (never treat it as "no turns").
export function chunkFiles(names: string[], dir: string): string[] {
  const files = names.filter((f) => /^chunk_\d+\.json$/.test(f)).sort();
  if (!files.length) throw new Error(`${dir} exists but has no chunk_*.json files; refusing to ingest (nothing was written)`);
  return files;
}

export type OverrideRow = { label: string; name: string; hidden?: boolean; at: number };

// Names the Chapterer may see, plus the fingerprint. Hidden labels are dropped from the names but still change the fingerprint.
export function partsNames(assignments: SpeakerAssignment[], overrides: OverrideRow[]) {
  const hidden = new Set(overrides.filter((o) => o.hidden).map((o) => o.label));
  const forParts: SpeakerAssignment[] = [
    ...assignments.filter((a) => !hidden.has(a.label)),
    ...overrides.filter((o) => !o.hidden).map((o) => ({ label: o.label, name: o.name, source: "manual" as const, evidenceTurnKey: "", at: o.at })),
  ];
  const fingerprint = namesFingerprint([...forParts, ...[...hidden].map((label) => ({ label, name: "\u2205hidden" }))]);
  return { forParts, fingerprint, hidden: [...hidden] };
}

// Without a local transcript dir, never overwrite stored transcript turns with lower-quality captions unless asked.
export function assertCaptionsAllowed(eventId: number, existing: "transcript" | "captions" | "none", allow: boolean) {
  if (existing === "transcript" && !allow)
    throw new Error(`event ${eventId}: data/transcripts/${eventId} is missing but transcript turns are stored; refusing to replace them with captions (pass --captions to override; nothing was written)`);
}
