import type { Tally, VoteRecord } from "@/lib/types";

// Legistar's own tally fields are always empty, so tallies are computed from per-person votes.
// A Map, not a plain object: a value like "constructor" must not hit Object.prototype.
const BUCKET = new Map<string, keyof Tally>([
  ["aye", "aye"],
  ["yes", "aye"],
  ["no", "no"],
  ["nay", "no"],
  ["excused", "excused"],
  ["absent", "excused"],
]);

export function computeTally(votes: VoteRecord[]): Tally {
  const tally: Tally = { aye: 0, no: 0, excused: 0, other: 0 };
  for (const vote of votes) {
    const bucket = BUCKET.get(vote.value.trim().toLowerCase()) ?? "other";
    tally[bucket] += 1;
  }
  return tally;
}

/** The count every vote shares, or none when they differ: a step or agenda item can stand for many votes (each budget
 * amendment is its own agenda entry), and showing one of them as "the" vote would be wrong. */
export function agreedTally(ts: Tally[]): Tally | undefined {
  const [first] = ts;
  return first && ts.every((t) => t.aye === first.aye && t.no === first.no && t.excused === first.excused && t.other === first.other) ? first : undefined;
}
