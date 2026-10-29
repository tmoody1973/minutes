// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

const event = { legistarId: 100, bodyId: 11, bodyName: "Zoning, Neighborhoods & Development Committee", startsAt: "2026-10-27T13:30:00-05:00", agendaUrl: "https://x/a" };
const future = { ...event, legistarId: 200, startsAt: "2999-01-01T09:00:00-06:00" };
const item = { legistarId: 5, eventId: 200, sequence: 1, matterId: 77, fileNumber: "250001", title: "Bookends" };
const history = { legistarId: 900, matterId: 77, date: "2026-10-27T00:00:00", bodyName: "ZND", actionName: "RECOMMENDED FOR PASSAGE", passed: true, eventId: 100 };

const changes = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("changes").collect());

describe("idempotent upserts", () => {
  it("event: same twice is one row; change reports only differing fields", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(internal.legistar.upsertEvent, event)).toEqual({ inserted: true, changedFields: [] });
    expect(await t.mutation(internal.legistar.upsertEvent, event)).toEqual({ inserted: false, changedFields: [] });
    expect(await t.run((ctx) => ctx.db.query("events").collect())).toHaveLength(1);
    const r = await t.mutation(internal.legistar.upsertEvent, { ...event, agendaUrl: "https://x/b" });
    expect(r).toEqual({ inserted: false, changedFields: ["agendaUrl"] });
  });

  it("a field that disappears upstream is cleared and reported; tally is not owned by upsert", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertEvent, event);
    const { agendaUrl: _a, ...bare } = event;
    expect(await t.mutation(internal.legistar.upsertEvent, bare)).toEqual({ inserted: false, changedFields: ["agendaUrl"] });
    const row = await t.run((ctx) => ctx.db.query("events").first());
    expect(row).not.toHaveProperty("agendaUrl");
    expect(await t.mutation(internal.legistar.upsertEvent, bare)).toEqual({ inserted: false, changedFields: [] });
    await t.mutation(internal.legistar.upsertEvent, future);
    await t.mutation(internal.legistar.upsertEventItem, { ...item, mover: "X" });
    await t.mutation(internal.legistar.setEventItemTally, { eventItemLegistarId: 5, tally: { aye: 1, no: 0, excused: 0, other: 0 } });
    expect((await t.mutation(internal.legistar.upsertEventItem, item)).changedFields).toEqual(["mover"]);
    expect((await t.run((ctx) => ctx.db.query("eventItems").first()))?.tally?.aye).toBe(1);
  });

  it("matter, person, and setEventItemTally update in place", async () => {
    const t = convexTest(schema, modules);
    const m = { legistarId: 77, fileNumber: "250001", title: "T", typeName: "Ordinance", statusName: "In Committee" };
    await t.mutation(internal.legistar.upsertMatter, m);
    expect((await t.mutation(internal.legistar.upsertMatter, { ...m, statusName: "Passed" })).changedFields).toEqual(["statusName"]);
    const p = { legistarId: 1, name: "A" };
    await t.mutation(internal.legistar.upsertPerson, p);
    expect(await t.mutation(internal.legistar.upsertPerson, { ...p, name: "B" })).toEqual({ inserted: false, changedFields: ["name"] });
    // a person on two bodies keeps both memberships
    await t.mutation(internal.legistar.upsertMembership, { personId: 1, bodyId: 1, role: "1st District" });
    await t.mutation(internal.legistar.upsertMembership, { personId: 1, bodyId: 11, role: "Member" });
    await t.mutation(internal.legistar.upsertMembership, { personId: 1, bodyId: 11, role: "Chair" });
    const ms = await t.run((ctx) => ctx.db.query("memberships").collect());
    expect(ms.map((m) => `${m.bodyId}:${m.role}`).sort()).toEqual(["11:Chair", "1:1st District"]);
    await t.mutation(internal.legistar.upsertEvent, future);
    await t.mutation(internal.legistar.upsertEventItem, item);
    const tally = { aye: 4, no: 1, excused: 0, other: 0 };
    await t.mutation(internal.legistar.setEventItemTally, { eventItemLegistarId: 5, tally });
    const row = await t.run((ctx) => ctx.db.query("eventItems").first());
    expect(row?.tally).toEqual(tally);
    // re-upserting the item must not wipe the tally
    await t.mutation(internal.legistar.upsertEventItem, item);
    expect((await t.run((ctx) => ctx.db.query("eventItems").first()))?.tally).toEqual(tally);
  });

  it("replaceVotes replaces the set for one item", async () => {
    const t = convexTest(schema, modules);
    const v1 = [{ eventItemId: 5, personId: 1, personName: "A", value: "Aye" }];
    await t.mutation(internal.legistar.replaceVotes, { eventItemId: 5, votes: v1 });
    await t.mutation(internal.legistar.replaceVotes, { eventItemId: 5, votes: [{ ...v1[0], value: "No" }] });
    const rows = await t.run((ctx) => ctx.db.query("votes").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe("No");
  });
});

describe("change log", () => {
  it("passed history -> one decision change; re-insert writes none", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertHistory, history);
    await t.mutation(internal.legistar.upsertHistory, history);
    const rows = await changes(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "decision", sourceKey: "history:900", matterId: 77, eventId: 100 });
  });

  it("passed=false is still a decision; unset passed is step_added", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertHistory, { ...history, legistarId: 1, passed: false });
    const { passed: _p, ...noPass } = history;
    await t.mutation(internal.legistar.upsertHistory, { ...noPass, legistarId: 2 });
    const kinds = Object.fromEntries((await changes(t)).map((c) => [c.sourceKey, c.kind]));
    expect(kinds).toEqual({ "history:1": "decision", "history:2": "step_added" });
  });

  it("editing an existing history row writes no new change", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertHistory, history);
    await t.mutation(internal.legistar.upsertHistory, { ...history, actionName: "OTHER" });
    expect(await changes(t)).toHaveLength(1);
  });

  it("new item with matterId on a future event -> one hearing_scheduled; re-upsert none", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertEvent, future);
    await t.mutation(internal.legistar.upsertEventItem, item);
    await t.mutation(internal.legistar.upsertEventItem, item);
    const rows = await changes(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "hearing_scheduled", sourceKey: "hearing:77:200", matterId: 77, eventId: 200 });
  });

  it("two items for the same matter on the same future event -> one hearing_scheduled", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertEvent, future);
    await t.mutation(internal.legistar.upsertEventItem, item);
    await t.mutation(internal.legistar.upsertEventItem, { ...item, legistarId: 6 });
    const rows = await changes(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceKey).toBe("hearing:77:200");
  });

  it("no change for past event, missing event, or item without matterId", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertEvent, { ...event, legistarId: 300 });
    await t.mutation(internal.legistar.upsertEventItem, { ...item, legistarId: 6, eventId: 300 });
    await t.mutation(internal.legistar.upsertEventItem, { ...item, legistarId: 7, eventId: 999 });
    await t.mutation(internal.legistar.upsertEvent, future);
    const { matterId: _m, ...noMatter } = item;
    await t.mutation(internal.legistar.upsertEventItem, { ...noMatter, legistarId: 8 });
    expect(await changes(t)).toHaveLength(0);
  });
});

describe("sync runs", () => {
  it("a failed run leaves rows untouched and lastSuccessfulSync returns the previous run", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertEvent, event);
    await t.mutation(internal.legistar.recordSyncRun, { startedAt: 1, finishedAt: 2, ok: true, scope: "top" });
    await t.mutation(internal.legistar.recordSyncRun, { startedAt: 3, finishedAt: 4, ok: false, error: "timeout", scope: "top" });
    await t.mutation(internal.legistar.recordSyncRun, { startedAt: 5, finishedAt: 6, ok: true, scope: "child" });
    expect(await t.run((ctx) => ctx.db.query("events").collect())).toHaveLength(1);
    const last = await t.query(api.legistar.lastSuccessfulSync, {});
    expect(last).toMatchObject({ finishedAt: 2, ok: true });
  });

  it("lastSuccessfulSync is null with no successful run", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.legistar.lastSuccessfulSync, {})).toBeNull();
  });
});

describe("withdrawn agenda items", () => {
  const items = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("eventItems").collect());
  const mark = (t: ReturnType<typeof convexTest>, presentIds: number[], at: number) =>
    t.mutation(internal.legistar.markEventItemsRemoved, { eventId: 200, presentIds, at });

  it("absent items get removedAt, are never deleted, and keep the first timestamp", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertEventItem, item);
    await t.mutation(internal.legistar.upsertEventItem, { ...item, legistarId: 6 });
    await t.mutation(internal.legistar.upsertEventItem, { ...item, legistarId: 7, eventId: 999 });
    await mark(t, [6], 111);
    await mark(t, [6], 222);
    const rows = await items(t);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.legistarId === 5)?.removedAt).toBe(111);
    expect(rows.find((r) => r.legistarId === 6)?.removedAt).toBeUndefined();
    expect(rows.find((r) => r.legistarId === 7)?.removedAt).toBeUndefined(); // other event untouched
  });

  it("an item that reappears has removedAt cleared by the normal upsert", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertEventItem, item);
    await mark(t, [], 111);
    expect((await items(t))[0].removedAt).toBe(111);
    expect((await t.mutation(internal.legistar.upsertEventItem, item)).changedFields).toEqual(["removedAt"]);
    expect((await items(t))[0]).not.toHaveProperty("removedAt");
  });
});

describe("sync freshness", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("syncEvents with Legistar down records ok:false and does not advance lastSuccessfulSync", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.recordSyncRun, { startedAt: 1, finishedAt: 2, ok: true, scope: "top" });
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 403 })); // 4xx: no retry backoff
    await t.action(internal.sync.syncEvents, { since: "2026-01-01", bodyIds: [1] });
    expect(await t.query(api.legistar.lastSuccessfulSync, {})).toMatchObject({ finishedAt: 2 });
    const runs = await t.run((ctx) => ctx.db.query("syncRuns").collect());
    expect(runs.filter((r) => !r.ok)).toHaveLength(1);
    expect(runs.find((r) => !r.ok)).toMatchObject({ scope: "top" });
  });

  it("syncAll alone writes no ok row", async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    await t.action(internal.sync.syncAll, {});
    vi.useRealTimers();
    expect(await t.query(api.legistar.lastSuccessfulSync, {})).toBeNull();
  });
});

describe("cancelled meetings (Ruling 40)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  const returned = { EventId: 13559, EventBodyId: 272, EventBodyName: "CITY PLAN COMMISSION", EventDate: "2026-09-28T00:00:00", EventTime: "1:30 PM" };

  it("marks items of stored in-window events that Legistar no longer returns, and nothing else", async () => {
    const t = convexTest(schema, modules);
    const mk = (legistarId: number, bodyId: number, startsAt: string) => ({ legistarId, bodyId, bodyName: "B", startsAt });
    await t.mutation(internal.legistar.upsertEvent, mk(13559, 272, "2026-09-28T13:30:00-05:00")); // still returned
    await t.mutation(internal.legistar.upsertEvent, mk(1, 272, "2026-09-20T13:30:00-05:00")); // in window, dropped -> removed
    await t.mutation(internal.legistar.upsertEvent, mk(2, 5, "2026-09-20T13:30:00-05:00")); // body not requested
    await t.mutation(internal.legistar.upsertEvent, mk(3, 272, "2026-08-01T13:30:00-05:00")); // before the window
    for (const [id, eventId] of [[10, 13559], [11, 1], [12, 2], [13, 3]]) {
      await t.mutation(internal.legistar.upsertEventItem, { legistarId: id, eventId, sequence: 1, matterId: 77, title: "t" });
    }
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async (u: string) => new Response(JSON.stringify(String(u).includes("/events?") ? [returned] : []), { status: 200 }));
    await t.action(internal.sync.syncEvents, { since: "2026-09-01", until: "2026-10-31", bodyIds: [272] });
    const removed = (await t.run((ctx) => ctx.db.query("eventItems").collect())).filter((i) => i.removedAt !== undefined).map((i) => i.legistarId);
    expect(removed).toEqual([11]);
  });
});

describe("matters.parcels", () => {
  const matter = { legistarId: 77, fileNumber: "250001", title: "T", typeName: "Ordinance", statusName: "In Committee" };
  const parcel = { taxkey: "5331104000", address: "3473 S 27TH ST", zoning: "PD", alder: 11, lotAreaSqFt: 201334.32, owner: "X", polygon: { type: "Polygon", coordinates: [] }, centroid: { lat: 1, lng: 2 } };
  it("survives a later matter upsert that does not carry it", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertMatter, matter);
    await t.mutation(internal.legistar.setMatterParcels, { matterId: 77, parcels: [parcel] });
    expect(await t.mutation(internal.legistar.upsertMatter, { ...matter, title: "T2" })).toEqual({ inserted: false, changedFields: ["title"] });
    expect(await t.query(internal.legistar.getMatterParcels, { matterId: 77 })).toEqual([parcel]);
  });
});
