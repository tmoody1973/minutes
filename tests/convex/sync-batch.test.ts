// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const future = { legistarId: 200, bodyId: 1, bodyName: "COMMON COUNCIL", startsAt: "2999-01-01T09:00:00-06:00" };
const item = (legistarId: number) => ({ legistarId, eventId: 200, sequence: legistarId, matterId: 77, fileNumber: "250001", title: "Bookends" });
const vote = (personId: number, value = "Aye") => ({ eventItemId: 5, personId, personName: `Member ${personId}`, value });
const tally = { aye: 2, no: 0, excused: 0, other: 0 };
const all = (t: ReturnType<typeof convexTest>, table: "changes" | "persons" | "votes" | "histories" | "eventItems") => t.run((ctx) => ctx.db.query(table).collect());

describe("batch saves (one call per meeting, file or voted item)", () => {
  it("upsertEventItems saves every item and records one hearing per matter per meeting", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) => ctx.db.insert("events", future));
    await t.mutation(internal.legistar.upsertEventItems, { items: [item(5), item(6)] });
    expect((await all(t, "eventItems")).map((i) => i.legistarId)).toEqual([5, 6]);
    expect((await all(t, "changes")).map((c) => c.sourceKey)).toEqual(["hearing:77:200"]);
  });
  it("upsertHistories saves rows and records a decision change once", async () => {
    const t = convexTest(schema, modules);
    const rows = [
      { legistarId: 900, matterId: 77, date: "2026-10-27T00:00:00", bodyName: "ZND", actionName: "RECOMMENDED FOR PASSAGE", passed: true },
      { legistarId: 901, matterId: 77, date: "2026-10-28T00:00:00", bodyName: "CITY CLERK", actionName: "PUBLISHED" },
    ];
    await t.mutation(internal.legistar.upsertHistories, { rows });
    await t.mutation(internal.legistar.upsertHistories, { rows });
    expect((await all(t, "histories")).length).toBe(2);
    expect((await all(t, "changes")).map((c) => [c.kind, c.sourceKey])).toEqual([
      ["decision", "history:900"],
      ["step_added", "history:901"],
    ]);
  });
  it("saveVotes stores names once per person, votes and tally; an unchanged re-save rewrites nothing", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) => ctx.db.insert("events", future));
    await t.mutation(internal.legistar.upsertEventItems, { items: [item(5)] });
    const votes = [vote(1), vote(2)];
    await t.mutation(internal.legistar.saveVotes, { eventItemId: 5, votes, tally });
    const before = (await all(t, "votes")).map((v) => v._id);
    await t.mutation(internal.legistar.saveVotes, { eventItemId: 5, votes, tally });
    expect((await all(t, "votes")).map((v) => v._id)).toEqual(before);
    expect((await all(t, "persons")).map((p) => p.name)).toEqual(["Member 1", "Member 2"]);
    expect((await all(t, "eventItems"))[0].tally).toEqual(tally);
    await t.mutation(internal.legistar.saveVotes, { eventItemId: 5, votes: [vote(1), vote(2, "No")], tally: { ...tally, aye: 1, no: 1 } });
    expect((await all(t, "votes")).map((v) => v.value).sort()).toEqual(["Aye", "No"]);
    expect((await all(t, "eventItems"))[0].tally).toEqual({ aye: 1, no: 1, excused: 0, other: 0 });
  });
});
