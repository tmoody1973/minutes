// Usage: npx tsx scripts/metrics.ts
// The numbers for DEVLOG and the README (brief §10), read from DEV. Speaker naming is counted from meetingView, the
// same query the meeting page uses, so the share matches what visitors see. Writes nothing.
import { convexRun } from "./convex-run";

type Meeting = { eventId: number; bodyName: string; startsAt: string; transcriptSource: "transcript" | "captions" | "none" };
type View = { turns: { endMs: number; display: string; source: string }[]; chapters: { located: string }[] };
type Counts = {
  filesTracked: number;
  filesLinkedAcrossBodies: number;
  editor: { checked: number; rejected: number; reasons: Record<string, number>; example: { text: string; reason?: string; detail: string | null } | null };
  cards: { written: number; shown: number };
};

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "n/a");
const ANON = /^(Speaker |Unidentified)/;

const meetings = convexRun<Meeting[]>("media:meetingList", {}).filter((m) => m.transcriptSource === "transcript");
let ms = 0, turns = 0, named = 0, chapters = 0, located = 0;
for (const m of meetings) {
  const v = convexRun<View>("media:meetingView", { eventId: m.eventId });
  const t = v.turns.filter((x) => x.source === "transcript");
  ms += Math.max(0, ...t.map((x) => x.endMs));
  turns += t.length;
  named += t.filter((x) => !ANON.test(x.display)).length;
  chapters += v.chapters.length;
  located += v.chapters.filter((c) => c.located !== "not-located").length;
}
const c = convexRun<Counts>("metrics:counts", {});

console.log(`Meetings transcribed (Muse Voice Transcribe): ${meetings.length}, ${(ms / 3_600_000).toFixed(1)} hours`);
console.log(`Files tracked: ${c.filesTracked}; linked across Plan Commission, ZND and Council: ${c.filesLinkedAcrossBodies}`);
console.log(`Speaker turns named: ${named}/${turns} (${pct(named, turns)})`);
console.log(`Chapters located in the video: ${located}/${chapters} (${pct(located, chapters)})`);
console.log(`Clerk cards: ${c.cards.written} written, ${c.cards.shown} with at least one approved sentence`);
const reasons = Object.entries(c.editor.reasons).map(([r, n]) => `${r} ${n}`).join(", ") || "none";
console.log(`Editor: ${c.editor.rejected}/${c.editor.checked} sentences rejected (${pct(c.editor.rejected, c.editor.checked)}); by reason: ${reasons}`);
if (c.editor.example) console.log(`  Example rejection (${c.editor.example.reason}): "${c.editor.example.text}" -> ${c.editor.example.detail}`);
console.log("Cost per meeting hour: not measured (no per-call cost is recorded; see the Meta API billing page)");
