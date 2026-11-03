// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const turn = (k: string, startMs: number, label: string | undefined, text = "hi") => ({ turnKey: k, chunk: 0, startMs, endMs: startMs + 10, label, text, source: "transcript" as const });
const keys = (t: ReturnType<typeof convexTest>, eventId: number) => t.query(internal.media.turnKeysForEvent, { eventId, cursor: null }).then((r) => r.keys.sort());

describe("turn writes", () => {
  it("re-write is idempotent and removes only this event's stale keys", async () => {
    const t = convexTest(schema, modules);
    const turns = [turn("0:1", 0, "c0:A"), turn("0:2", 20, "c0:B")];
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns });
    await t.mutation(internal.media.upsertTurns, { eventId: 2, turns: [turn("0:1", 0, "c0:A"), turn("0:9", 5, undefined)] });
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns });
    expect(await keys(t, 1)).toEqual(["0:1", "0:2"]);
    // new ingest drops 0:2 and edits 0:1
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns: [turn("0:1", 0, "c0:A", "edited")] });
    const stored = await keys(t, 1);
    await t.mutation(internal.media.removeTurns, { eventId: 1, turnKeys: stored.filter((k) => k !== "0:1") });
    expect(await keys(t, 1)).toEqual(["0:1"]);
    expect(await keys(t, 2)).toEqual(["0:1", "0:9"]);
    const view = await t.query(api.media.meetingView, { eventId: 1 });
    expect(view.turns.map((x) => x.text)).toEqual(["edited"]);
  });
});

describe("overrides", () => {
  it("survive ingest writes; meetingView applies them and omits `by`", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns: [turn("0:1", 0, "c0:A"), turn("0:2", 20, "c0:B")] });
    await t.mutation(internal.media.replaceAssignments, { eventId: 1, assignments: [{ label: "c0:A", name: "Auto Name", source: "legistar", evidenceTurnKey: "0:1" }] });
    await t.mutation(internal.media.setOverride, { eventId: 1, label: "c0:A", name: "Manual Name", by: "tarik", at: 5 });
    // a full ingest write
    await t.mutation(internal.media.replaceAssignments, { eventId: 1, assignments: [{ label: "c0:A", name: "Auto Name", source: "legistar", evidenceTurnKey: "0:1" }] });
    await t.mutation(internal.media.replaceChapters, { eventId: 1, chapters: [] });
    expect(await t.query(internal.media.overridesForEvent, { eventId: 1 })).toHaveLength(1);
    const view = await t.query(api.media.meetingView, { eventId: 1 });
    expect(view.turns.map((x) => x.display)).toEqual(["Manual Name", "Speaker A"]);
    expect(JSON.stringify(view)).not.toContain("tarik");
    await expect(t.mutation(internal.media.setOverride, { eventId: 1, label: "c0:B", name: "  ", by: "tarik", at: 6 })).rejects.toThrow();
  });
  it("clear deletes only that override row", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.media.setOverride, { eventId: 1, label: "c0:A", name: "A", by: "tarik", at: 1 });
    await t.mutation(internal.media.setOverride, { eventId: 1, label: "c0:B", name: "B", by: "tarik", at: 1 });
    await t.mutation(internal.media.setOverride, { eventId: 2, label: "c0:A", name: "C", by: "tarik", at: 1 });
    await t.mutation(internal.media.clearOverride, { eventId: 1, label: "c0:A" });
    expect((await t.query(internal.media.overridesForEvent, { eventId: 1 })).map((o) => o.label)).toEqual(["c0:B"]);
    expect(await t.query(internal.media.overridesForEvent, { eventId: 2 })).toHaveLength(1);
  });
});

describe("model decisions", () => {
  it("a fresh verdict replaces the stored one for the same key (latest `at` wins)", async () => {
    const t = convexTest(schema, modules);
    const row = { candidateKey: "k", confirm: true, reason: "r1", model: "m", at: 1 };
    await t.mutation(internal.media.recordConfirmations, { eventId: 1, rows: [row] });
    const reject = { ...row, confirm: false, reason: "r2", at: 2 };
    await t.mutation(internal.media.recordConfirmations, { eventId: 1, rows: [reject] });
    expect(await t.query(internal.media.confirmationsForEvent, { eventId: 1 })).toEqual([reject]);
    await t.mutation(internal.media.recordConfirmations, { eventId: 1, rows: [row] }); // older: ignored
    expect(await t.query(internal.media.confirmationsForEvent, { eventId: 1 })).toEqual([reject]);
  });
  it("removeTurns returns the actual deleted count", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns: [turn("0:1", 0, "c0:A")] });
    expect(await t.mutation(internal.media.removeTurns, { eventId: 1, turnKeys: ["0:1", "0:9"] })).toEqual({ removed: 1 });
  });
  it("a hidden override shows Speaker X over an automatic name; clear restores it", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns: [turn("0:1", 0, "c0:E")] });
    await t.mutation(internal.media.replaceAssignments, { eventId: 1, assignments: [{ label: "c0:E", name: "Willie Smith", source: "legistar", evidenceTurnKey: "0:1" }] });
    await t.mutation(internal.media.setOverride, { eventId: 1, label: "c0:E", hidden: true, by: "tarik", at: 5 });
    expect((await t.query(api.media.meetingView, { eventId: 1 })).turns[0].display).toBe("Speaker A");
    expect((await t.query(internal.media.overridesForEvent, { eventId: 1 }))[0]).toMatchObject({ hidden: true });
    await t.mutation(internal.media.clearOverride, { eventId: 1, label: "c0:E" });
    expect((await t.query(api.media.meetingView, { eventId: 1 })).turns[0].display).toBe("Willie Smith");
  });
  it("chapters are replaced per event only", async () => {
    const t = convexTest(schema, modules);
    const c = { eventItemId: 9, located: "cue" as const, startMs: 1, endMs: 2, parts: [{ kind: "testimony", startMs: 1, endMs: 2 }], partsSource: "model" as const };
    await t.mutation(internal.media.replaceChapters, { eventId: 1, chapters: [c] });
    await t.mutation(internal.media.replaceChapters, { eventId: 2, chapters: [c] });
    await t.mutation(internal.media.replaceChapters, { eventId: 1, chapters: [{ ...c, parts: [], partsSource: "none" }] });
    expect(await t.query(internal.media.chaptersForEvent, { eventId: 1 })).toHaveLength(1);
    expect((await t.query(internal.media.chaptersForEvent, { eventId: 2 }))[0].parts).toHaveLength(1);
  });
});

describe("meetingView source and automatic names", () => {
  it("returns per-turn source and transcriptSource; captions and none", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns: [{ ...turn("cap:0", 0, undefined), source: "captions" as const }] });
    await t.mutation(internal.media.upsertTurns, { eventId: 2, turns: [turn("0:1", 0, "c0:A")] });
    const cap = await t.query(api.media.meetingView, { eventId: 1 });
    expect(cap.transcriptSource).toBe("captions");
    expect(cap.turns[0].source).toBe("captions");
    expect((await t.query(api.media.meetingView, { eventId: 2 })).transcriptSource).toBe("transcript");
    const none = await t.query(api.media.meetingView, { eventId: 3 });
    expect(none.transcriptSource).toBe("none");
    expect(none.turns).toEqual([]);
  });
  it("shows an automatic assignment's name; self-intro is asHeard, legistar is not", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns: [turn("0:1", 0, "c0:A"), turn("0:2", 20, "c0:B"), turn("0:3", 40, "c0:C")] });
    await t.mutation(internal.media.replaceAssignments, {
      eventId: 1,
      assignments: [
        { label: "c0:A", name: "Official Person", personId: 7, source: "legistar", evidenceTurnKey: "0:1" },
        { label: "c0:B", name: "Resident Heard", source: "self-intro", evidenceTurnKey: "0:2" },
      ],
    });
    const v = await t.query(api.media.meetingView, { eventId: 1 });
    expect(v.turns.map((x) => [x.display, x.asHeard])).toEqual([["Official Person", false], ["Resident Heard", true], ["Speaker A", false]]);
  });
});

describe("meetingView page fields", () => {
  it("returns the event, each chapter's agenda item and its votes sorted by name; no extra treatment for anyone", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertEvent, { legistarId: 13559, bodyId: 272, bodyName: "CITY PLAN COMMISSION", startsAt: "2026-09-28T13:30:00-05:00", clipId: 5310, agendaUrl: "https://x/agenda.pdf" });
    await t.mutation(internal.legistar.upsertEventItem, {
      legistarId: 495640, eventId: 13559, sequence: 5, matterId: 74560, fileNumber: "260533", title: "Bookends title", actionName: "APPROVED CONDITIONALLY", passed: true, videoStartSec: 2051,
    });
    await t.mutation(internal.legistar.setEventItemTally, { eventItemLegistarId: 495640, tally: { aye: 2, no: 0, excused: 1, other: 0 } });
    await t.mutation(internal.legistar.replaceVotes, {
      eventItemId: 495640,
      votes: [
        { eventItemId: 495640, personId: 3, personName: "Willie Smith", value: "Aye" },
        { eventItemId: 495640, personId: 1, personName: "Tarik Moody", value: "Aye" },
        { eventItemId: 495640, personId: 2, personName: "Allyson Nemec", value: "Excused" },
      ],
    });
    await t.mutation(internal.legistar.upsertMatter, {
      legistarId: 74560, fileNumber: "260533", title: "Bookends title", typeName: "Ordinance", statusName: "In Council-Passage",
      attachments: [{ name: "Map", hyperlink: "https://x/map.pdf" }, { name: "CPC Staff Report", hyperlink: "https://x/staff.pdf" }, { name: "Exhibit A as of 09.25.26", hyperlink: "https://x/exa.pdf" }],
    });
    await t.mutation(internal.media.replaceChapters, { eventId: 13559, chapters: [{ eventItemId: 495640, startMs: 2051000, endMs: 5832000, located: "video-index", parts: [] }] });
    const v = await t.query(api.media.meetingView, { eventId: 13559 });
    expect(v.chapters[0].docs).toEqual([
      { label: "Staff report", hyperlink: "https://x/staff.pdf" },
      { label: "Exhibit A", hyperlink: "https://x/exa.pdf" },
    ]);
    expect(v.event).toMatchObject({ bodyName: "CITY PLAN COMMISSION", startsAt: "2026-09-28T13:30:00-05:00", clipId: 5310, agendaUrl: "https://x/agenda.pdf" });
    expect(v.chapters[0].item).toMatchObject({ fileNumber: "260533", matterId: 74560, title: "Bookends title", actionName: "APPROVED CONDITIONALLY", passed: true, tally: { aye: 2, no: 0, excused: 1, other: 0 } });
    expect(v.chapters[0].votes).toEqual([
      { personId: 2, name: "Allyson Nemec", value: "Excused" },
      { personId: 1, name: "Tarik Moody", value: "Aye" },
      { personId: 3, name: "Willie Smith", value: "Aye" },
    ]);
  });
  it("event is null and chapters carry no item for an unknown meeting", async () => {
    const t = convexTest(schema, modules);
    const v = await t.query(api.media.meetingView, { eventId: 999 });
    expect(v.event).toBeNull();
    expect(v.chapters).toEqual([]);
  });
});

describe("meetingList", () => {
  it("lists every meeting, newest first, with body, date, chapter count and transcript source", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertEvent, { legistarId: 1, bodyId: 272, bodyName: "CITY PLAN COMMISSION", startsAt: "2026-09-28T13:30:00-05:00", clipId: 5310 });
    await t.mutation(internal.legistar.upsertEvent, { legistarId: 2, bodyId: 1, bodyName: "COMMON COUNCIL", startsAt: "2026-10-13T09:00:00-05:00" });
    await t.mutation(internal.legistar.upsertEvent, { legistarId: 3, bodyId: 11, bodyName: "ZND", startsAt: "2026-10-06T09:00:00-05:00" }); // no chapters
    await t.mutation(internal.media.replaceChapters, { eventId: 1, chapters: [{ eventItemId: 10, located: "cue", parts: [] }, { eventItemId: 11, located: "cue", parts: [] }] });
    await t.mutation(internal.media.replaceChapters, { eventId: 2, chapters: [{ eventItemId: 20, located: "cue", parts: [] }] });
    await t.mutation(internal.media.upsertTurns, { eventId: 2, turns: [{ ...turn("cap:0", 0, undefined), source: "captions" as const }] });
    expect(await t.query(api.media.meetingList, {})).toEqual([
      { eventId: 2, bodyName: "COMMON COUNCIL", startsAt: "2026-10-13T09:00:00-05:00", chapters: 1, transcriptSource: "captions" },
      { eventId: 3, bodyName: "ZND", startsAt: "2026-10-06T09:00:00-05:00", chapters: 0, transcriptSource: "none" },
      { eventId: 1, bodyName: "CITY PLAN COMMISSION", startsAt: "2026-09-28T13:30:00-05:00", chapters: 2, transcriptSource: "none" },
    ]);
  });
});
