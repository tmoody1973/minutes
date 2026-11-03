// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const step = (legistarId: number, actionName: string, passed?: boolean) => ({
  legistarId, matterId: 1, date: "2026-10-29T00:00:00", bodyName: "FINANCE & PERSONNEL COMMITTEE", actionName, eventId: 50, ...(passed !== undefined && { passed }),
});

// The budget's shape: many amendment votes and one final action at one meeting, the final action with a tally.
async function seed() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.legistar.upsertMatter, { legistarId: 1, fileNumber: "260001", title: "Communication relating to the proposed 2027 budget.", typeName: "Budget", statusName: "In Committee" });
  await t.mutation(internal.legistar.upsertEvent, { legistarId: 50, bodyId: 5, bodyName: "FINANCE & PERSONNEL COMMITTEE", startsAt: "2026-10-29T14:00:00Z" });
  await t.mutation(internal.legistar.upsertEventItem, { legistarId: 500, eventId: 50, sequence: 1, matterId: 1, fileNumber: "260001", title: "t", actionName: "REFERRED WITHOUT RECOMMENDATION AND ASSIGNED TO", passed: true });
  await t.mutation(internal.legistar.saveVotes, { eventItemId: 500, votes: [{ eventItemId: 500, personId: 9, personName: "A", value: "Aye" }], tally: { aye: 5, no: 0, excused: 0, other: 0 } });
  await t.mutation(internal.legistar.upsertHistory, { ...step(10, "ASSIGNED TO"), date: "2026-04-21T00:00:00", bodyName: "COMMON COUNCIL", eventId: undefined });
  // Each amendment is its own agenda entry with its own vote, as on the real Oct 29 budget meeting.
  for (const [n, aye] of [[501, 5], [502, 2]] as const) {
    await t.mutation(internal.legistar.upsertEventItem, { legistarId: n, eventId: 50, sequence: n, matterId: 1, fileNumber: "260001", title: "t", actionName: "AMENDED", passed: false });
    await t.mutation(internal.legistar.saveVotes, { eventItemId: n, votes: [{ eventItemId: n, personId: 9, personName: "A", value: "Aye" }], tally: { aye, no: 0, excused: 0, other: 0 } });
  }
  for (const id of [11, 12, 13]) await t.mutation(internal.legistar.upsertHistory, step(id, "AMENDED", false));
  await t.mutation(internal.legistar.upsertHistory, step(14, "REFERRED WITHOUT RECOMMENDATION AND ASSIGNED TO", true));
  return t;
}

describe("fileRecords", () => {
  it("collapses repeated steps into one record with a count", async () => {
    const t = await seed();
    const recs = await t.query(api.ask.fileRecords, { fileNumber: "260001" });
    const amended = recs.filter((r) => r.text.includes("Amended"));
    expect(amended).toHaveLength(1);
    expect(amended[0].text).toContain("Amended (failed), 3 times");
  });
  it("drops Legistar's dangling 'to' and puts the vote only on the step it was taken on", async () => {
    const t = await seed();
    const texts = (await t.query(api.ask.fileRecords, { fileNumber: "260001" })).map((r) => r.text);
    expect(texts.join(" ")).not.toMatch(/assigned to\b/i);
    expect(texts).toContain("File 260001, Apr 21, 2026: Common Council: Assigned.");
    expect(texts.find((s) => s.includes("Referred"))).toMatch(/Referred without recommendation and assigned \(passed\)\. Vote: 5 aye/);
    // Two amendment entries that day with different votes: which vote goes with which step is unknown, so none is shown.
    expect(texts.find((s) => s.includes("Amended"))).not.toContain("Vote");
  });
});
