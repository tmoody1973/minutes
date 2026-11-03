// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const REZ = (addr: string) => `A substitute ordinance relating to a change in zoning from RT4 to LB2 for the property located at ${addr}.`;
const lot = { taxkey: "T", address: "X", zoning: "RT4", alder: 4, lotAreaSqFt: null, owner: null, polygon: null, centroid: { lat: 43.04, lng: -87.9 } };
const NOW = Date.parse("2026-10-30T15:00:00Z");
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

async function seed() {
  const t = convexTest(schema, modules);
  const matter = async (id: number, file: string, addr: string) => {
    await t.mutation(internal.legistar.upsertMatter, { legistarId: id, fileNumber: file, title: REZ(addr), typeName: "Ordinance", statusName: "In Committee" });
    await t.mutation(internal.legistar.setMatterParcels, { matterId: id, parcels: [lot] });
  };
  await matter(1, "250001", "100 North Test Street");
  await matter(2, "250002", "200 North Test Street");
  await matter(3, "250003", "300 North Test Street");
  await t.mutation(internal.legistar.upsertMatter, { legistarId: 4, fileNumber: "250004", title: "A resolution relating to a grant.", typeName: "Resolution", statusName: "Passed" });
  // Coming up: matter 1 on a Council agenda in 5 days; matter 3 in 20 days (outside the week).
  await t.mutation(internal.legistar.upsertEvent, { legistarId: 50, bodyId: 1, bodyName: "COMMON COUNCIL", startsAt: day(5) });
  await t.mutation(internal.legistar.upsertEvent, { legistarId: 51, bodyId: 1, bodyName: "COMMON COUNCIL", startsAt: day(20) });
  await t.mutation(internal.legistar.upsertEventItem, { legistarId: 500, eventId: 50, sequence: 1, matterId: 1, title: "t" });
  await t.mutation(internal.legistar.upsertEventItem, { legistarId: 501, eventId: 51, sequence: 1, matterId: 3, title: "t" });
  // Not zoning, on the same agenda: a grant resolution.
  await t.mutation(internal.legistar.upsertEventItem, { legistarId: 502, eventId: 50, sequence: 2, matterId: 4, fileNumber: "250004", title: "A resolution relating to a grant." });
  // Decided: matter 2 passed 3 days ago; matter 3 passed 30 days ago; matter 4 (not zoning) passed yesterday.
  await t.mutation(internal.legistar.upsertHistory, { legistarId: 900, matterId: 2, date: day(-3).slice(0, 19), bodyName: "COMMON COUNCIL", actionName: "PASSED", passed: true });
  await t.mutation(internal.legistar.upsertHistory, { legistarId: 901, matterId: 3, date: day(-30).slice(0, 19), bodyName: "COMMON COUNCIL", actionName: "PASSED", passed: true });
  await t.mutation(internal.legistar.upsertHistory, { legistarId: 902, matterId: 4, date: day(-1).slice(0, 19), bodyName: "COMMON COUNCIL", actionName: "ADOPTED", passed: true });
  return t;
}

describe("weekAtCityHall", () => {
  it("files on an agenda in the next 7 days, soonest first; zoning keeps the address-led wording", async () => {
    const t = await seed();
    const w = await t.query(api.week.weekAtCityHall, { now: NOW });
    expect(w.comingUp.map((c) => c.href)).toEqual(["/files/250001", "/files/250004"]);
    expect(w.comingUp[0]).toMatchObject({ topic: "development", title: expect.stringMatching(/^100 N\. Test St\. is on the Common Council agenda for /) });
    expect(w.comingUp[0].meta).toBeUndefined();
    expect(w.comingUp[1]).toMatchObject({ topic: "council", title: "A resolution relating to a grant.", meta: expect.stringMatching(/^On the Common Council agenda, /) });
  });
  it("each file's latest decision in the last 7 days, newest first, across every body", async () => {
    const t = await seed();
    const w = await t.query(api.week.weekAtCityHall, { now: NOW });
    expect(w.decided.map((c) => c.href)).toEqual(["/files/250004", "/files/250002"]);
    expect(w.decided[0].meta).toMatch(/^Adopted at Common Council, /);
    expect(w.decided[1]).toMatchObject({ topic: "development", title: expect.stringMatching(/^200 N\. Test St\.: Passed at Common Council, /) });
  });
  it("sorts a file into the topic of the committee whose agenda it is on", async () => {
    const t = await seed();
    await t.mutation(internal.legistar.upsertMatter, { legistarId: 6, fileNumber: "250006", title: "Class B tavern license renewal.", typeName: "Communication", statusName: "In Committee" });
    await t.mutation(internal.legistar.upsertEvent, { legistarId: 52, bodyId: 10, bodyName: "LICENSES COMMITTEE", startsAt: day(2) });
    await t.mutation(internal.legistar.upsertEventItem, { legistarId: 503, eventId: 52, sequence: 1, matterId: 6, fileNumber: "250006", title: "Class B tavern license renewal." });
    const w = await t.query(api.week.weekAtCityHall, { now: NOW });
    expect(w.comingUp[0]).toMatchObject({ href: "/files/250006", topic: "licenses", meta: expect.stringMatching(/^On the Licenses Committee agenda, /) });
  });
});
