// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const BOOKENDS = "A substitute ordinance relating to the change in zoning from General Planned Development known as Bookends to a Detailed Planned Development known as Zenith to allow the construction of a multi-family residential building at 711 East Kilbourn Avenue and 822 North Van Buren Street.";

async function seed() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.legistar.upsertMatter, { legistarId: 74560, fileNumber: "260533", title: BOOKENDS, typeName: "Ordinance", statusName: "In Council-Passage" });
  await t.mutation(internal.legistar.upsertMatter, { legistarId: 4, fileNumber: "250004", title: "A resolution relating to a parking lot sale.", typeName: "Resolution", statusName: "Passed" });
  await t.run(async (ctx) => {
    await ctx.db.insert("events", { legistarId: 13559, bodyId: 272, bodyName: "CITY PLAN COMMISSION", startsAt: "2026-09-28T13:30:00-05:00" });
    await ctx.db.insert("chapters", { eventId: 13559, eventItemId: 495640, startMs: 2_000_000, endMs: 5_000_000, located: "video-index", parts: [] });
    await ctx.db.insert("turns", { eventId: 13559, turnKey: "c1:1", chunk: 1, startMs: 3_709_000, endMs: 3_720_000, label: "AQ", text: "I'm just totally against the height of this building.", source: "transcript" });
  });
  return t;
}

describe("search", () => {
  it("finds a file by a typed street address and by its number, without owners", async () => {
    const t = await seed();
    const byAddress = await t.query(api.search.search, { q: "711 E Kilbourn Ave" });
    expect(byAddress.files[0]).toMatchObject({ href: "/files/260533", fileNumber: "260533" });
    const byNumber = await t.query(api.search.search, { q: "260533" });
    expect(byNumber.files[0].fileNumber).toBe("260533");
  });
  it("finds words said in a meeting and links to the chapter they were said in", async () => {
    const t = await seed();
    const r = await t.query(api.search.search, { q: "against the height" });
    expect(r.quotes).toEqual([
      { href: "/meetings/13559?item=495640", text: "I'm just totally against the height of this building.", meeting: "City Plan Commission, Sep 28, 2026", at: expect.any(String), captions: false },
    ]);
  });
  it("ignores one-character queries", async () => {
    const t = await seed();
    expect(await t.query(api.search.search, { q: " a " })).toEqual({ files: [], quotes: [] });
  });
});
