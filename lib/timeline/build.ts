import type { EventItemRecord, EventRecord, HistoryRecord, MatterRecord, Tally, TimelineStep } from "@/lib/types";

const LABELS = new Map([
  ["COMMON COUNCIL", "Common Council"],
  ["CITY PLAN COMMISSION", "City Plan Commission"],
  ["ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE", "Zoning, Neighborhoods & Development"],
  ["MAYOR", "Mayor"],
]);

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\w)/g, (_, a, b) => a + b.toUpperCase());
const label = (name: string) => LABELS.get(name.trim().toUpperCase()) ?? titleCase(name.trim());
const day = (iso: string) => iso.slice(0, 10);

type StoredItem = EventItemRecord & { removedAt?: number };

// Pure: steps come only from stored Legistar history rows plus future agenda items (Ruling 28).
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

  const rows = histories.filter((h) => h.bodyName.trim().toUpperCase() !== "CITY CLERK");
  for (const h of rows) {
    const body = label(h.bodyName);
    const date = day(h.date);
    const key = `${body}|${date}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.actions.push(h.actionName);
      if (h.passed !== undefined) existing.passed = h.passed;
      continue;
    }
    // Prefer the agenda row (non-null sequence) over minutes-only duplicates.
    const matches = items.filter((i) => h.eventId !== undefined && i.eventId === h.eventId && i.matterId === h.matterId);
    const it = matches.find((i) => i.sequence !== null) ?? matches[0];
    const step: TimelineStep = {
      body,
      date,
      actions: [h.actionName],
      ...(h.passed !== undefined && { passed: h.passed }),
      ...(h.eventId !== undefined && { eventId: h.eventId }),
      ...(it && { eventItemId: it.legistarId }),
      ...(it?.videoStartSec !== undefined && { videoStartSec: it.videoStartSec }),
      ...(it && tallies.has(it.legistarId) && { tally: tallies.get(it.legistarId) }),
      upcoming: false,
    };
    byKey.set(key, step);
    steps.push(step);
  }

  const eventById = new Map(events.map((e) => [e.legistarId, e]));
  for (const i of items as StoredItem[]) {
    const ev = eventById.get(i.eventId);
    if (!ev || i.removedAt || i.matterId !== matter.legistarId || new Date(ev.startsAt) <= now) continue;
    const body = label(ev.bodyName);
    const date = day(ev.startsAt);
    if (byKey.has(`${body}|${date}`)) continue;
    const step: TimelineStep = { body, date, actions: ["SCHEDULED"], eventId: ev.legistarId, eventItemId: i.legistarId, upcoming: true };
    byKey.set(`${body}|${date}`, step);
    steps.push(step);
  }

  // Array.prototype.sort is stable, so same-date ties keep Legistar's order.
  return steps.sort((a, b) => a.date.localeCompare(b.date));
}
