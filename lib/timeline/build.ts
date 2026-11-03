import type { EventItemRecord, EventRecord, HistoryRecord, MatterRecord, Tally, TimelineStep } from "@/lib/types";

const LABELS = new Map([
  ["COMMON COUNCIL", "Common Council"],
  ["CITY PLAN COMMISSION", "City Plan Commission"],
  ["ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE", "Zoning, Neighborhoods & Development"],
  ["MAYOR", "Mayor"],
]);

// Small words stay lowercase after the first ("Public Safety and Health Committee").
const SMALL = new Set(["and", "of", "the", "for", "on", "to", "in"]);
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])(\w+)/g, (m, a, w, i) => (i > 0 && SMALL.has(w) ? m : a + w[0].toUpperCase() + w.slice(1)));
/** Display name for a Legistar body, shared by the timeline and Near me so a body reads the same everywhere. */
export const label = (name: string) => LABELS.get(name.trim().toUpperCase()) ?? titleCase(name.trim());
const day = (iso: string) => iso.slice(0, 10);

// Same-date tie-break: CPC < ZND < Council < Mayor; Council rows keep history order (stable sort).
const RANK = new Map([["City Plan Commission", 0], ["Zoning, Neighborhoods & Development", 1], ["Common Council", 2], ["Mayor", 3]]);
const rank = (body: string) => RANK.get(body) ?? 2;

// Prefer the agenda row (non-null sequence) over minutes-only duplicates.
const pick = (rows: EventItemRecord[]) => rows.find((i) => i.sequence !== null) ?? rows[0];

const sameTally = (a: Tally, b: Tally) => a.aye === b.aye && a.no === b.no && a.excused === b.excused && a.other === b.other;

// A step can stand for many votes on one file at one meeting (each budget amendment is its own agenda entry), and
// history rows don't say which entry they came from. A vote is shown only when every one of them had the same count.
function link(rows: EventItemRecord[], tallies: Map<number, Tally>): Partial<TimelineStep> {
  if (!rows.length) return {};
  const it = pick(rows);
  const ts = rows.flatMap((r) => tallies.get(r.legistarId) ?? []);
  const tally = ts.length && ts.every((t) => sameTally(t, ts[0])) ? ts[0] : undefined;
  return {
    eventItemId: it.legistarId,
    ...(it.videoStartSec !== undefined && { videoStartSec: it.videoStartSec }),
    ...(tally && { tally }),
  };
}

// Pure: steps come only from stored Legistar history rows plus agenda items without a history row (Ruling 28, 40).
export function buildTimeline(
  matter: MatterRecord,
  histories: HistoryRecord[],
  items: EventItemRecord[],
  events: EventRecord[],
  tallies: Map<number, Tally>,
  now: Date,
): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const byKey = new Map<string, TimelineStep>();
  const outcomes = new Map<TimelineStep, Set<boolean>>();
  const live = items.filter((i) => !i.removedAt);

  for (const h of histories.filter((r) => r.bodyName.trim().toUpperCase() !== "CITY CLERK")) {
    const body = label(h.bodyName);
    const date = day(h.date);
    const key = `${body}|${date}`;
    const rows = h.eventId === undefined ? [] : live.filter((i) => i.eventId === h.eventId && i.matterId === h.matterId);
    let step = byKey.get(key);
    if (step) {
      step.actions.push(h.actionName);
      if (step.eventId === undefined && h.eventId !== undefined) Object.assign(step, { eventId: h.eventId });
      if (step.eventItemId === undefined) Object.assign(step, link(rows, tallies));
    } else {
      step = { body, date, actions: [h.actionName], ...(h.eventId !== undefined && { eventId: h.eventId }), ...link(rows, tallies), upcoming: false };
      byKey.set(key, step);
      outcomes.set(step, new Set());
      steps.push(step);
    }
    if (h.passed !== undefined) outcomes.get(step)!.add(h.passed);
  }
  // Rows that disagree must not be summarized as one outcome.
  for (const [step, seen] of outcomes) if (seen.size === 1) step.passed = [...seen][0];

  const eventById = new Map(events.map((e) => [e.legistarId, e]));
  const mine = live.filter((i) => i.matterId === matter.legistarId && eventById.has(i.eventId));
  const byEvent = new Map<number, EventItemRecord[]>();
  for (const i of mine) byEvent.set(i.eventId, [...(byEvent.get(i.eventId) ?? []), i]);
  for (const [eventId, rows] of byEvent) {
    const ev = eventById.get(eventId)!;
    const body = label(ev.bodyName);
    const date = day(ev.startsAt);
    if (byKey.has(`${body}|${date}`)) continue;
    // Future: SCHEDULED. Past with no history row for the same body+date: the hearing is in progress or the
    // clerk has not posted the outcome yet, so say only that it is on the agenda.
    const upcoming = new Date(ev.startsAt) > now;
    const step: TimelineStep = { body, date, actions: [upcoming ? "SCHEDULED" : "ON AGENDA"], eventId, eventItemId: pick(rows).legistarId, upcoming };
    byKey.set(`${body}|${date}`, step);
    steps.push(step);
  }

  // Array.prototype.sort is stable, so equal date+rank keeps Legistar's order.
  return steps.sort((a, b) => a.date.localeCompare(b.date) || rank(a.body) - rank(b.body));
}
