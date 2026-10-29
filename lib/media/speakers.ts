import { sparkJSON } from "@/lib/meta/spark";
import type { Cue, SpeakerAssignment, Turn } from "@/lib/types";

// Names come only from Legistar roster + transcript cue, self-introduction, or a manual override.
// Anything else stays an anonymous "Speaker X". Wrong name > no name, so every doubt resolves to no name.

export type RosterEntry = { personId: number; name: string; role?: string };

const HONORIFICS = new Set([
  "ald", "alderman", "alderwoman", "alderperson", "commissioner", "mr", "ms", "mrs", "dr", "mayor", "councilmember", "councilman", "councilwoman", "hon",
]);
const bare = (w: string) => w.toLowerCase().replace(/\./g, "");

export function normalizeName(name: string): { first?: string; initial?: string; surname: string } {
  const words = name.split(/\s+/).filter(Boolean).filter((w) => !HONORIFICS.has(bare(w)));
  const clean = words.map((w) => w.toLowerCase().replace(/[^\p{L}'’-]/gu, "")).filter(Boolean);
  const surname = clean[clean.length - 1] ?? "";
  if (clean.length < 2) return { surname };
  const head = clean[0];
  const isInitial = head.length === 1;
  return { ...(isInitial ? {} : { first: head }), initial: head[0], surname };
}

export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function matchRoster(heard: string, roster: RosterEntry[]): RosterEntry | null {
  const h = normalizeName(heard);
  if (!h.surname) return null;
  const hits = roster.filter((r) => {
    const n = normalizeName(r.name);
    if (!n.surname) return false;
    const tol = Math.min(h.surname.length, n.surname.length) >= 6 ? 2 : 1;
    if (editDistance(h.surname, n.surname) > tol) return false;
    return !(n.initial && h.first && !h.first.startsWith(n.initial));
  });
  return hits.length === 1 ? hits[0] : null;
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s.'’-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
// Stored names in mixed case are shown as-is; shouting Legistar names get title case.
const displayName = (name: string) => (/\p{Ll}/u.test(name) ? name : titleCase(name));

const nameKey = (name: string) => {
  const n = normalizeName(name);
  return `${n.first ?? n.initial ?? ""} ${n.surname}`.trim();
};

type LabelOf = Map<string, string | null>;
const labelMap = (turns: Turn[]): LabelOf => new Map(turns.map((t) => [t.turnKey, t.label]));

function candidateFor(cue: Cue, labels: LabelOf, roster: RosterEntry[]): SpeakerAssignment | null {
  const label = labels.get(cue.targetTurnKey);
  if (!label) return null;
  const hit = matchRoster(cue.name, roster);
  if (hit) return { label, name: displayName(hit.name), personId: hit.personId, source: "legistar", evidenceTurnKey: cue.turnKey };
  if (cue.kind === "self") return { label, name: cue.name, source: "self-intro", evidenceTurnKey: cue.turnKey };
  return null;
}

export function assignFromCues(turns: Turn[], cues: Cue[], roster: RosterEntry[]): SpeakerAssignment[] {
  const labels = labelMap(turns);
  const byLabel = new Map<string, SpeakerAssignment[]>();
  for (const cue of cues) {
    const c = candidateFor(cue, labels, roster);
    if (c) byLabel.set(c.label, [...(byLabel.get(c.label) ?? []), c]);
  }
  const out: SpeakerAssignment[] = [];
  for (const cands of byLabel.values()) {
    if (new Set(cands.map((c) => nameKey(c.name))).size === 1) out.push(cands[0]);
  }
  return out;
}

export function validateAssignment(a: SpeakerAssignment, turns: Turn[], cues: Cue[], roster: RosterEntry[]): boolean {
  if (a.source === "manual") return true;
  const labels = labelMap(turns);
  return cues.some((cue) => {
    const c = candidateFor(cue, labels, roster);
    return c !== null && c.label === a.label && c.name === a.name && c.source === a.source;
  });
}

const letters = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letters(Math.floor(i / 26) - 1) + letters(i % 26));

export function nameSpeakers(turns: Turn[], accepted: SpeakerAssignment[]): { turnKey: string; display: string; asHeard: boolean }[] {
  const named = new Map<string, SpeakerAssignment>();
  for (const a of accepted) {
    const cur = named.get(a.label);
    if (!cur || (a.source === "manual" && cur.source !== "manual")) named.set(a.label, a);
  }
  const anon = new Map<string, string>();
  return turns.map((t) => {
    if (t.label === null) return { turnKey: t.turnKey, display: "Unidentified speaker", asHeard: false };
    const a = named.get(t.label);
    if (a) return { turnKey: t.turnKey, display: a.name, asHeard: a.source === "self-intro" };
    if (!anon.has(t.label)) anon.set(t.label, `Speaker ${letters(anon.size)}`);
    return { turnKey: t.turnKey, display: anon.get(t.label)!, asHeard: false };
  });
}

// ---- Muse Spark confirmation (can only keep or drop a candidate; never add or rename) ----

const SYSTEM = `You check one proposed speaker name against a public-meeting transcript. Labels like "c3:B" are anonymous diarization labels; the transcript is machine-made and imperfect.
You are given a candidate: label L is the person N. Answer whether the transcript really shows that the speaker labeled L is N: either L introduces themself as N, or the speaker just before hands the floor to N (for example roll call, "you are recognized", "go ahead") and L is the one who then speaks.
Neutrality rule: a wrong name on a real person's words is the worst outcome; an unnamed speaker is fine. When in doubt, reject. Merely being mentioned, thanked, or talked about is NOT confirmation.
Reply with only JSON: {"confirm": true|false, "reason": "<one short sentence>"}`;

const isVerdict = (x: unknown): x is { confirm: boolean; reason: string } =>
  typeof x === "object" && x !== null && typeof (x as { confirm?: unknown }).confirm === "boolean" && typeof (x as { reason?: unknown }).reason === "string";

const CONTEXT = 3;
const clip = (s: string) => (s.length > 600 ? `${s.slice(0, 600)}...` : s);

function promptFor(a: SpeakerAssignment, turns: Turn[]): string {
  const i = turns.findIndex((t) => t.turnKey === a.evidenceTurnKey);
  const window = turns.slice(Math.max(0, i - CONTEXT), i + CONTEXT + 1);
  const lines = window.map((t) => `${t.turnKey === a.evidenceTurnKey ? ">> " : "   "}[${t.label ?? "none"}] ${clip(t.text)}`);
  return `Candidate: label ${a.label} is "${a.name}" (basis: ${a.source === "legistar" ? "roster name heard in transcript" : "self-introduction"}).\n">>" marks the turn that contains the cue.\n\n${lines.join("\n")}`;
}

export async function confirmAssignments(
  candidates: SpeakerAssignment[],
  turns: Turn[],
  spark: typeof sparkJSON = sparkJSON,
): Promise<{ accepted: SpeakerAssignment[]; rejected: { a: SpeakerAssignment; reason: string }[] }> {
  const accepted: SpeakerAssignment[] = [];
  const rejected: { a: SpeakerAssignment; reason: string }[] = [];
  for (const a of candidates) {
    try {
      const v = await spark(SYSTEM, promptFor(a, turns), isVerdict);
      if (v.confirm) accepted.push(a);
      else rejected.push({ a, reason: v.reason });
    } catch (e) {
      console.warn(`speaker confirmation failed for ${a.label} (${a.name}):`, e instanceof Error ? e.message : e);
      rejected.push({ a, reason: "model unavailable" });
    }
  }
  return { accepted, rejected };
}
