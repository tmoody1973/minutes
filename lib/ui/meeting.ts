// Display helpers for the meeting page (mockups MinPhoneMeeting, MinLaptopMeeting). Pure: safe in client and server code.
import { type StatedPosition, statedPosition } from "../media/positions";
import type { Tally } from "../types";
import { actionText, tallyText } from "./file";
import { placeHeading } from "./near";

// 2051000 -> "34:11"; 5832000 -> "1:37:12".
export function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// The item's own words: its addresses if the title names any, else the title minus the legal opening.
export function chapterTitle(title: string, fileNumber?: string): string {
  const place = fileNumber ? placeHeading(title, fileNumber) : "";
  if (place && !place.startsWith("File ")) return place;
  const subject = title
    .replace(/^an?\s+(?:substitute\s+)?(?:ordinance|resolution)\s+relating\s+to\s+(?:the\s+)?/i, "")
    .replace(/\.\s*$/, "")
    .trim();
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

export function chapterResult(item: { actionName?: string; tally?: Tally }): string | null {
  if (!item.actionName) return null;
  return item.tally ? `${actionText([item.actionName])}, ${tallyText(item.tally)}` : actionText([item.actionName]);
}

// Stored part kinds (lib/types ChapterPart) as people say them.
export const PART_LABELS: Record<string, string> = {
  presentation: "Staff presentation",
  applicant: "Applicant",
  testimony: "Public testimony",
  discussion: "Discussion",
  vote: "Vote",
};

// "3 hr 29 min of video · 6 decisions": length from the last transcript or chapter end; a decision is an agenda
// item with a recorded action.
export function meetingSummary(v: {
  turns: { endMs: number }[];
  chapters: { endMs: number | null; item: { actionName?: string } | null }[];
}): string {
  const end = Math.max(0, ...v.turns.map((t) => t.endMs), ...v.chapters.map((c) => c.endMs ?? 0));
  const mins = Math.round(end / 60000);
  const length = mins >= 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins} min`;
  const decisions = v.chapters.filter((c) => c.item?.actionName).length;
  return [end > 0 && `${length} of video`, `${decisions} ${decisions === 1 ? "decision" : "decisions"}`].filter(Boolean).join(" · ");
}

// A listed speaker spoke at least this many words during testimony and nothing in the chapter's other parts.
// Commissioners and staff also talk during presentation and discussion; residents, on the real Sep 28 hearings,
// did not. Cost: a resident who also answered a question during discussion is left off (better than listing a
// commissioner as public testimony). ponytail: a heuristic, not identity; the speaker review names people properly.
const MIN_TESTIMONY_WORDS = 30;

export interface TestimonySpeaker {
  display: string;
  asHeard: boolean;
  startMs: number;
  turnKey: string;
  position: StatedPosition | null;
  /** The whole turn the position quote came from, for "view raw" and "watch this moment". */
  positionTurn: { text: string; startMs: number } | null;
}

// Who spoke during public testimony, in speaking order, with a position only from their own words.
export function testimonySpeakers(
  turns: { turnKey: string; display: string; asHeard: boolean; startMs: number; text: string }[],
  parts: { kind: string; startMs: number; endMs: number }[],
): TestimonySpeaker[] {
  const within = (t: { startMs: number }, ps: typeof parts) => ps.some((w) => t.startMs >= w.startMs && t.startMs < w.endMs);
  const windows = parts.filter((p) => p.kind === "testimony");
  const otherParts = parts.filter((p) => p.kind !== "testimony");
  const elsewhere = new Set(turns.filter((t) => within(t, otherParts)).map((t) => t.display));
  const inside = turns.filter((t) => within(t, windows));
  const bySpeaker = new Map<string, typeof inside>();
  for (const t of inside) bySpeaker.set(t.display, [...(bySpeaker.get(t.display) ?? []), t]);
  const out: TestimonySpeaker[] = [];
  for (const [display, own] of bySpeaker) {
    const wordCount = own.reduce((n, t) => n + t.text.split(/\s+/).filter(Boolean).length, 0);
    if (wordCount < MIN_TESTIMONY_WORDS || elsewhere.has(display)) continue;
    // Every turn is checked: turns that disagree mean no position, never the first one found (decision 005).
    const hits = own.map((t) => ({ t, p: statedPosition(t.text) })).filter((x) => x.p !== null);
    const hit = new Set(hits.map((x) => x.p!.position)).size === 1 ? hits[0] : undefined;
    out.push({
      display,
      asHeard: own.some((t) => t.asHeard),
      startMs: own[0].startMs,
      turnKey: own[0].turnKey,
      position: hit?.p ?? null,
      positionTurn: hit ? { text: hit.t.text, startMs: hit.t.startMs } : null,
    });
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}
