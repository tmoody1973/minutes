import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTimeline } from "@/lib/timeline/build";
import { computeTally } from "@/lib/legistar/tally";
import { parseEvent, parseEventItem, parseHistory, parseMatter, parseVote } from "@/lib/legistar/parse";
import type { EventItemRecord, EventRecord, Tally } from "@/lib/types";

type Raw = Record<string, unknown>;
const fx = (name: string): any => JSON.parse(readFileSync(`tests/fixtures/legistar/${name}.json`, "utf8"));
const histories = (id: number) => fx(`histories-${id}`).map((r: Raw) => parseHistory(r, id));
const items: EventItemRecord[] = fx("eventitems-13559").map(parseEventItem);
const cpcEvent = parseEvent(fx("event-13559"));
const tally = (name: string, id: number) =>
  computeTally(fx(name).map((r: Raw) => parseVote(r, id)));
const NOW = new Date("2026-10-29T12:00:00-05:00");

// Constructed (not in fixtures): ZND 13446/13445 and Council 13429 events, and the Council/ZND event items.
const ev = (legistarId: number, bodyId: number, bodyName: string, startsAt: string): EventRecord =>
  ({ legistarId, bodyId, bodyName, startsAt });
const events = [
  cpcEvent,
  ev(13445, 11, "ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE", "2026-10-06T14:00:00-05:00"),
  ev(13446, 11, "ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE", "2026-10-27T14:00:00-05:00"),
  ev(13429, 1, "COMMON COUNCIL", "2026-10-13T09:00:00-05:00"),
];
const item = (legistarId: number, eventId: number, matterId: number, extra: Partial<EventItemRecord> = {}): EventItemRecord =>
  ({ legistarId, eventId, sequence: 1, matterId, title: "t", ...extra });

describe("buildTimeline", () => {
  it("builds Southgate's six steps", () => {
    const southgate = { ...parseMatter(fx("matter-74560")), legistarId: 74559 }; // constructed: no 74559 matter fixture
    const allItems = [...items, item(496602, 13445, 74559), item(496980, 13429, 74559)];
    const tallies = new Map<number, Tally>([
      [495638, tally("votes-495638", 495638)],
      [496980, tally("votes-496980", 496980)],
    ]);
    const steps = buildTimeline(southgate, histories(74559), allItems, events, tallies, NOW);
    expect(steps.map((s) => [s.body, s.date, s.upcoming])).toEqual([
      ["Common Council", "2026-07-31", false],
      ["Zoning, Neighborhoods & Development", "2026-08-07", false],
      ["City Plan Commission", "2026-09-28", false],
      ["Zoning, Neighborhoods & Development", "2026-10-06", false],
      ["Common Council", "2026-10-13", false],
      ["Mayor", "2026-10-15", false],
    ]);
    expect(steps[2]).toMatchObject({ eventItemId: 495638, videoStartSec: 829, tally: { aye: 5, no: 0, excused: 2 } });
    expect(steps[4].tally).toEqual({ aye: 13, no: 0, excused: 2, other: 0 });
    expect(steps.some((s) => s.body === "CITY CLERK")).toBe(false);
  });

  it("merges Bookends' two CPC rows and ends at ZND Oct 27", () => {
    const matter = parseMatter(fx("matter-74560"));
    const steps = buildTimeline(matter, histories(74560), items, events, new Map(), NOW);
    const cpc = steps.filter((s) => s.body === "City Plan Commission");
    expect(cpc).toHaveLength(1);
    expect(cpc[0].actions).toEqual(["APPROVED CONDITIONALLY", "REFERRED TO"]);
    expect(cpc[0].eventItemId).toBe(495640);
    const last = steps[steps.length - 1];
    expect([last.body, last.date]).toEqual(["Zoning, Neighborhoods & Development", "2026-10-27"]);
    expect(steps.some((s) => s.body === "Common Council" && s.actions.includes("PASSED"))).toBe(false);
  });

  it("adds an upcoming step from a future event item, unless removed", () => {
    const matter = parseMatter(fx("matter-74560"));
    const council = ev(20001, 1, "COMMON COUNCIL", "2026-11-08T09:00:00-06:00");
    const future = item(900001, 20001, 74560);
    const run = (i: EventItemRecord) =>
      buildTimeline(matter, histories(74560), [...items, i], [...events, council], new Map(), NOW);
    const last = run(future).at(-1)!;
    expect(last).toMatchObject({ body: "Common Council", date: "2026-11-08", actions: ["SCHEDULED"], upcoming: true, eventId: 20001, eventItemId: 900001 });
    expect(run({ ...future, removedAt: 1 } as EventItemRecord).every((s) => !s.upcoming)).toBe(true);
  });

  it("suppresses an upcoming step when history already has that body and date", () => {
    const matter = parseMatter(fx("matter-74560"));
    const znd = ev(20002, 11, "ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE", "2026-10-30T14:00:00-05:00");
    const hist = [...histories(74560), { ...histories(74560)[0], legistarId: 1, bodyName: "ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE", date: "2026-10-30T00:00:00" }];
    const steps = buildTimeline(matter, hist, [item(900002, 20002, 74560)], [znd], new Map(), NOW);
    expect(steps.filter((s) => s.date === "2026-10-30")).toHaveLength(1);
    expect(steps.every((s) => !s.upcoming)).toBe(true);
  });
});
