// Display helpers for the meeting page (mockups MinPhoneMeeting, MinLaptopMeeting). Pure: safe in client and server code.
import { type StatedPosition, statedPosition } from "../media/positions";
import { agreedTally } from "../legistar/tally";
import type { Tally } from "../types";
import { actionText, stepDate, subjectOf, tallyText } from "./file";
import { bodyLabel, placeHeading } from "./near";

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
  // "Communication from the Mayor relating to the proposed 2027 budget" -> "The proposed 2027 budget", as on the file page.
  const named = subjectOf(title);
  if (named) return named.charAt(0).toUpperCase() + named.slice(1);
  const subject = title
    .replace(/^an?\s+(?:substitute\s+)?(?:ordinance|resolution)\s+relating\s+to\s+(?:the\s+)?/i, "")
    .replace(/\.\s*$/, "")
    .trim();
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

const KIND = /^(?:an?\s+)?((?:substitute\s+)?(?:charter\s+)?(?:ordinance|resolution|motion|communication))\b/i;
/** "A charter ordinance relating to…" -> "Charter ordinance": tells apart files whose subjects read the same. */
export function titleKind(title: string): string | null {
  const m = KIND.exec(title.trim());
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase().replace(/\s+/g, " ") : null;
}

export interface AgendaItem { legistarId: number; sequence: number | null; title: string; fileNumber?: string; actionName?: string; tally?: Tally; videoStartSec?: number; removedAt?: number; mover?: string; seconder?: string; minutesNote?: string }
export interface AgendaRow { eventItemId: number; title: string; fileNumber: string; actions: string[]; tally?: Tally; startSec?: number; mover?: string; seconder?: string; note?: string }

// Legistar writes members in capitals ("ALD. MOORE").
const nameCase = (s: string) => s.trim().toLowerCase().replace(/(^|[\s.-])(\w)/g, (_, a, c) => a + c.toUpperCase());

// A meeting without chapters, read from the records alone: each agenda item with a file, in agenda order. The minutes
// add a row per further motion on the same file (each budget amendment is one), so those fold into their item; every
// row is one recorded action, the same count the file page shows. Notices with no file ("will be webcast") are left out.
export function agendaRows(items: AgendaItem[]): AgendaRow[] {
  const live = items.filter((i) => !i.removedAt && i.fileNumber);
  const agenda = live.filter((i) => i.sequence !== null).sort((a, b) => a.sequence! - b.sequence!);
  const seen = new Set<string>();
  return agenda.flatMap((a) => {
    if (seen.has(a.fileNumber!)) return [];
    seen.add(a.fileNumber!);
    const minutes = live.filter((i) => i.sequence === null && i.fileNumber === a.fileNumber).sort((x, y) => x.legistarId - y.legistarId);
    const all = [a, ...minutes];
    const tally = agreedTally(all.flatMap((i) => (i.tally ? [i.tally] : [])));
    const starts = all.flatMap((i) => (i.videoStartSec === undefined ? [] : [i.videoStartSec]));
    const acted = all.filter((i) => i.actionName);
    // "Moved by" only when the item had one motion; with several (amendments), each had its own mover.
    const only = acted.length === 1 ? acted[0] : undefined;
    return [{
      eventItemId: a.legistarId,
      title: a.title,
      fileNumber: a.fileNumber!,
      actions: all.flatMap((i) => (i.actionName ? [i.actionName] : [])),
      ...(tally && { tally }),
      ...(starts.length && { startSec: Math.min(...starts) }),
      ...(only?.mover && { mover: nameCase(only.mover) }),
      ...(only?.seconder && { seconder: nameCase(only.seconder) }),
      ...(a.minutesNote && { note: a.minutesNote }),
    }];
  });
}

export function chapterResult(item: { actionName?: string; tally?: Tally }): string | null {
  if (!item.actionName) return null;
  return item.tally ? `${actionText([item.actionName])}, ${tallyText(item.tally)}` : actionText([item.actionName]);
}

// "2026-09-28T17:30:00-05:00" -> "Sep 28, 2026": Legistar start times carry Milwaukee's offset, so the first ten
// characters are the local date.
export const meetingDate = (startsAt: string) => stepDate(startsAt.slice(0, 10));

// A quote as a reporter pastes it: words, speaker as the page shows them (an unnamed "Speaker B" stays as is),
// meeting, video time and a link that opens the chapter.
export function quoteCitation(c: { quote: string; speaker: string; bodyName: string; startsAt: string; startMs: number; url: string }): string {
  return `“${c.quote}” — ${c.speaker}, ${bodyLabel(c.bodyName)} meeting, ${meetingDate(c.startsAt)}, at ${clock(c.startMs)}. ${c.url}`;
}

// The meeting's votes as CSV rows, one per member vote. Every member's row is built the same way (Global Constraints).
export function voteRows(
  startsAt: string,
  bodyName: string,
  chapters: { item: { title: string; fileNumber?: string; actionName?: string; tally?: Tally } | null; votes: { name: string; value: string }[] }[],
): string[][] {
  const header = ["meeting_date", "body", "chapter", "file_number", "item_title", "result", "member", "vote"];
  const rows = chapters.flatMap((c, i) =>
    c.votes.map((v) => [startsAt.slice(0, 10), bodyLabel(bodyName), String(i + 1), c.item?.fileNumber ?? "", c.item?.title ?? "", (c.item && chapterResult(c.item)) ?? "", v.name, v.value]),
  );
  return [header, ...rows];
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
  agenda?: { actions: string[] }[];
}): string {
  const end = Math.max(0, ...v.turns.map((t) => t.endMs), ...v.chapters.map((c) => c.endMs ?? 0));
  const mins = Math.round(end / 60000);
  const length = mins >= 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins} min`;
  const decisions = v.chapters.length ? v.chapters.filter((c) => c.item?.actionName).length : (v.agenda ?? []).filter((a) => a.actions.length).length;
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
