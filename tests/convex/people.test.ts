// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

async function seed() {
  const t = convexTest(schema, modules);
  const person = (legistarId: number, name: string) => t.mutation(internal.legistar.upsertPerson, { legistarId, name });
  await person(1, "ALD. BAUMAN");
  await person(2, "ALD. PEREZ");
  await person(3, "JANE COMMISSIONER");
  const seat = (personId: number, bodyId: number, role?: string) => t.mutation(internal.legistar.upsertMembership, { personId, bodyId, ...(role && { role }) });
  await seat(1, 1, "4th District");
  await seat(2, 1, "12th District");
  await seat(1, 5, "Member");
  await seat(2, 5, "Chair");
  await seat(3, 272, "Member");
  await t.mutation(internal.legistar.upsertEvent, { legistarId: 50, bodyId: 5, bodyName: "PUBLIC WORKS COMMITTEE", startsAt: "2026-11-11T09:00:00-06:00" });
  await t.mutation(internal.legistar.upsertEvent, { legistarId: 51, bodyId: 272, bodyName: "CITY PLAN COMMISSION", startsAt: "2026-11-16T13:30:00-06:00" });
  return t;
}

describe("who decides", () => {
  it("the members of the body meeting, alphabetical, with roles and each alder's district", async () => {
    const t = await seed();
    expect(await t.query(api.people.whoDecides, { eventId: 50 })).toEqual({
      bodyName: "PUBLIC WORKS COMMITTEE",
      members: [
        { personId: 1, name: "Ald. Bauman", role: "Member", district: 4 },
        { personId: 2, name: "Ald. Perez", role: "Chair", district: 12 },
      ],
    });
    expect((await t.query(api.people.whoDecides, { eventId: 51 }))!.members).toEqual([{ personId: 3, name: "Jane Commissioner", role: "Member" }]);
    expect(await t.query(api.people.whoDecides, { eventId: 99 })).toBeNull();
  });
  it("the alderperson for a district comes from the Council seat titles", async () => {
    const t = await seed();
    expect(await t.query(api.people.alderFor, { district: 12 })).toEqual({ name: "Ald. Perez", district: 12 });
    expect(await t.query(api.people.alderFor, { district: 7 })).toBeNull();
  });
});
