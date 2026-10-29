// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
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
    expect(await t.mutation(api.legistar.upsertEvent, event)).toEqual({ inserted: true, changedFields: [] });
    expect(await t.mutation(api.legistar.upsertEvent, event)).toEqual({ inserted: false, changedFields: [] });
    expect(await t.run((ctx) => ctx.db.query("events").collect())).toHaveLength(1);
    const r = await t.mutation(api.legistar.upsertEvent, { ...event, agendaUrl: "https://x/b" });
    expect(r).toEqual({ inserted: false, changedFields: ["agendaUrl"] });
  });

  it("a field that disappears upstream is cleared and reported; tally is not owned by upsert", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.legistar.upsertEvent, event);
    const { agendaUrl: _a, ...bare } = event;
    expect(await t.mutation(api.legistar.upsertEvent, bare)).toEqual({ inserted: false, changedFields: ["agendaUrl"] });
    const row = await t.run((ctx) => ctx.db.query("events").first());
    expect(row).not.toHaveProperty("agendaUrl");
    expect(await t.mutation(api.legistar.upsertEvent, bare)).toEqual({ inserted: false, changedFields: [] });
    await t.mutation(api.legistar.upsertEvent, future);
    await t.mutation(api.legistar.upsertEventItem, { ...item, mover: "X" });
    await t.mutation(api.legistar.setEventItemTally, { eventItemLegistarId: 5, tally: { aye: 1, no: 0, excused: 0, other: 0 } });
    expect((await t.mutation(api.legistar.upsertEventItem, item)).changedFields).toEqual(["mover"]);
    expect((await t.run((ctx) => ctx.db.query("eventItems").first()))?.tally?.aye).toBe(1);
  });

  it("matter, person, and setEventItemTally update in place", async () => {
    const t = convexTest(schema, modules);
    const m = { legistarId: 77, fileNumber: "250001", title: "T", typeName: "Ordinance", statusName: "In Committee" };
    await t.mutation(api.legistar.upsertMatter, m);
    expect((await t.mutation(api.legistar.upsertMatter, { ...m, statusName: "Passed" })).changedFields).toEqual(["statusName"]);
    const p = { legistarId: 1, name: "A" };
    await t.mutation(api.legistar.upsertPerson, p);
    expect(await t.mutation(api.legistar.upsertPerson, { ...p, name: "B" })).toEqual({ inserted: false, changedFields: ["name"] });
    // a person on two bodies keeps both memberships
    await t.mutation(api.legistar.upsertMembership, { personId: 1, bodyId: 1, role: "1st District" });
    await t.mutation(api.legistar.upsertMembership, { personId: 1, bodyId: 11, role: "Member" });
    await t.mutation(api.legistar.upsertMembership, { personId: 1, bodyId: 11, role: "Chair" });
    const ms = await t.run((ctx) => ctx.db.query("memberships").collect());
    expect(ms.map((m) => `${m.bodyId}:${m.role}`).sort()).toEqual(["11:Chair", "1:1st District"]);
    await t.mutation(api.legistar.upsertEvent, future);
    await t.mutation(api.legistar.upsertEventItem, item);
    const tally = { aye: 4, no: 1, excused: 0, other: 0 };
    await t.mutation(api.legistar.setEventItemTally, { eventItemLegistarId: 5, tally });
    const row = await t.run((ctx) => ctx.db.query("eventItems").first());
    expect(row?.tally).toEqual(tally);
    // re-upserting the item must not wipe the tally
    await t.mutation(api.legistar.upsertEventItem, item);
    expect((await t.run((ctx) => ctx.db.query("eventItems").first()))?.tally).toEqual(tally);
  });

  it("replaceVotes replaces the set for one item", async () => {
    const t = convexTest(schema, modules);
    const v1 = [{ eventItemId: 5, personId: 1, personName: "A", value: "Aye" }];
    await t.mutation(api.legistar.replaceVotes, { eventItemId: 5, votes: v1 });
    await t.mutation(api.legistar.replaceVotes, { eventItemId: 5, votes: [{ ...v1[0], value: "No" }] });
    const rows = await t.run((ctx) => ctx.db.query("votes").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe("No");
  });
});

describe("change log", () => {
  it("passed history -> one decision change; re-insert writes none", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.legistar.upsertHistory, history);
    await t.mutation(api.legistar.upsertHistory, history);
    const rows = await changes(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "decision", sourceKey: "history:900", matterId: 77, eventId: 100 });
  });

  it("passed=false is still a decision; unset passed is step_added", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.legistar.upsertHistory, { ...history, legistarId: 1, passed: false });
    const { passed: _p, ...noPass } = history;
    await t.mutation(api.legistar.upsertHistory, { ...noPass, legistarId: 2 });
    const kinds = Object.fromEntries((await changes(t)).map((c) => [c.sourceKey, c.kind]));
    expect(kinds).toEqual({ "history:1": "decision", "history:2": "step_added" });
  });

  it("editing an existing history row writes no new change", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.legistar.upsertHistory, history);
    await t.mutation(api.legistar.upsertHistory, { ...history, actionName: "OTHER" });
    expect(await changes(t)).toHaveLength(1);
  });

  it("new item with matterId on a future event -> one hearing_scheduled; re-upsert none", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.legistar.upsertEvent, future);
    await t.mutation(api.legistar.upsertEventItem, item);
    await t.mutation(api.legistar.upsertEventItem, item);
    const rows = await changes(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "hearing_scheduled", sourceKey: "eventitem:5", matterId: 77, eventId: 200 });
  });

  it("no change for past event, missing event, or item without matterId", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.legistar.upsertEvent, { ...event, legistarId: 300 });
    await t.mutation(api.legistar.upsertEventItem, { ...item, legistarId: 6, eventId: 300 });
    await t.mutation(api.legistar.upsertEventItem, { ...item, legistarId: 7, eventId: 999 });
    await t.mutation(api.legistar.upsertEvent, future);
    const { matterId: _m, ...noMatter } = item;
    await t.mutation(api.legistar.upsertEventItem, { ...noMatter, legistarId: 8 });
    expect(await changes(t)).toHaveLength(0);
  });
});

describe("sync runs", () => {
  it("a failed run leaves rows untouched and lastSuccessfulSync returns the previous run", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.legistar.upsertEvent, event);
    await t.mutation(api.legistar.recordSyncRun, { startedAt: 1, finishedAt: 2, ok: true, scope: "top" });
    await t.mutation(api.legistar.recordSyncRun, { startedAt: 3, finishedAt: 4, ok: false, error: "timeout", scope: "top" });
    await t.mutation(api.legistar.recordSyncRun, { startedAt: 5, finishedAt: 6, ok: true, scope: "child" });
    expect(await t.run((ctx) => ctx.db.query("events").collect())).toHaveLength(1);
    const last = await t.query(api.legistar.lastSuccessfulSync, {});
    expect(last).toMatchObject({ finishedAt: 2, ok: true });
  });

  it("lastSuccessfulSync is null with no successful run", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.legistar.lastSuccessfulSync, {})).toBeNull();
  });
});
