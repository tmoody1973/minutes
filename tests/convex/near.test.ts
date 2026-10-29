// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const REZ = "A substitute ordinance relating to a change in zoning from RT4 to LB2 for the property located at 1 N Test St.";
const parcel = (lat: number | null, lng = -87.9) => ({
  taxkey: "T", address: "1 N TEST ST", zoning: "RT4", alder: 1, lotAreaSqFt: 1, owner: null, polygon: null,
  centroid: lat === null ? null : { lat, lng },
});
const CENTER = { lat: 43, lng: -87.9 };
// 0.01 degrees latitude ~ 0.69 mi
const near = (d: number) => parcel(43 + d / 69.093);

async function seed() {
  const t = convexTest(schema, modules);
  const m = async (id: number, file: string, title: string, status: string, parcels?: ReturnType<typeof parcel>[]) => {
    await t.mutation(internal.legistar.upsertMatter, { legistarId: id, fileNumber: file, title, typeName: "Ordinance", statusName: status });
    if (parcels) await t.mutation(internal.legistar.setMatterParcels, { matterId: id, parcels });
  };
  await m(1, "A1", REZ, "In Committee", [near(0.3)]);                       // upcoming, 0.3 mi
  await m(2, "A2", REZ, "Passed", [near(0.1), near(0.45)]);                  // decided, nearest 0.1
  await m(3, "A3", REZ, "Passed", [near(0.9)]);                              // too far
  await m(4, "A4", "A resolution relating to a grant.", "Passed", [near(0.1)]); // not a zoning kind
  await m(5, "A5", REZ, "In Committee", [parcel(null)]);                     // no centroid
  await m(6, "A6", REZ, "In Committee");                                      // no parcels at all
  await m(7, "A7", REZ, "Placed On File", [near(0.2)]);
  await t.run(async (ctx) => {
    await ctx.db.insert("events", { legistarId: 10, bodyId: 11, bodyName: "ZND", startsAt: "2999-01-01T09:00:00-06:00" });
    await ctx.db.insert("events", { legistarId: 11, bodyId: 11, bodyName: "CPC", startsAt: "2999-03-01T09:00:00-06:00" });
    await ctx.db.insert("events", { legistarId: 12, bodyId: 11, bodyName: "Old", startsAt: "2020-01-01T09:00:00-06:00" });
    const it = (legistarId: number, eventId: number, extra = {}) => ctx.db.insert("eventItems", { legistarId, eventId, sequence: 1, matterId: 1, title: "t", ...extra });
    await it(100, 11);                                  // later
    await it(101, 10);                                  // earlier -> chosen
    await it(102, 12);                                  // past
    await ctx.db.insert("eventItems", { legistarId: 103, eventId: 10, sequence: 1, matterId: 7, title: "t", removedAt: 5 }); // removed
  });
  return t;
}

describe("filesNear", () => {
  it("lists only zoning-kind matters with a centroid within radius, sorted by nearest-parcel distance", async () => {
    const t = await seed();
    const r = await t.query(api.near.filesNear, { ...CENTER, filter: "all" });
    expect(r.map((x) => x.fileNumber)).toEqual(["A2", "A7", "A1"]);
    expect(r.map((x) => x.distanceMi)).toEqual([0.1, 0.2, 0.3]);
    expect(r[0]).toMatchObject({ matterId: 2, title: REZ, statusName: "Passed" });
  });
  it("nextHearing is the earliest future non-removed event item", async () => {
    const t = await seed();
    const r = await t.query(api.near.filesNear, { ...CENTER, filter: "all" });
    const a1 = r.find((x) => x.fileNumber === "A1")!;
    expect(a1.nextHearing).toEqual({ date: "2999-01-01T09:00:00-06:00", body: "ZND", eventId: 10 });
    expect(r.find((x) => x.fileNumber === "A7")!.nextHearing).toBeUndefined();
  });
  it("upcoming = has nextHearing; decided = Passed/Placed on File style statuses; radius narrows", async () => {
    const t = await seed();
    expect((await t.query(api.near.filesNear, { ...CENTER, filter: "upcoming" })).map((x) => x.fileNumber)).toEqual(["A1"]);
    expect((await t.query(api.near.filesNear, { ...CENTER, filter: "decided" })).map((x) => x.fileNumber)).toEqual(["A2", "A7"]);
    expect((await t.query(api.near.filesNear, { ...CENTER, radiusMi: 0.15, filter: "all" })).map((x) => x.fileNumber)).toEqual(["A2"]);
  });
  it("validates arguments", async () => {
    const t = await seed();
    const q = (a: object) => t.query(api.near.filesNear, { ...CENTER, filter: "all", ...a } as never);
    await expect(q({ lat: 91 })).rejects.toThrow();
    await expect(q({ lng: -181 })).rejects.toThrow();
    await expect(q({ radiusMi: 0 })).rejects.toThrow();
    await expect(q({ radiusMi: 5.1 })).rejects.toThrow();
  });
});

const locs = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("matterLocations").collect());

describe("matterLocations is maintained with the matter", () => {
  const base = { legistarId: 1, fileNumber: "A1", title: REZ, typeName: "Ordinance", statusName: "In Committee" };
  it("created on parcels, updated on title/status, removed when parcels clear or lose centroids or kind changes", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertMatter, base);
    expect(await locs(t)).toHaveLength(0); // no parcels yet
    await t.mutation(internal.legistar.setMatterParcels, { matterId: 1, parcels: [near(0.1), parcel(null)] });
    const [row] = await locs(t);
    expect(row).toMatchObject({ matterId: 1, fileNumber: "A1", kind: "rezoning", statusName: "In Committee" });
    expect(row.centroids).toHaveLength(1);
    await t.mutation(internal.legistar.upsertMatter, { ...base, statusName: "Passed" });
    expect(await locs(t)).toMatchObject([{ statusName: "Passed" }]);
    await t.mutation(internal.legistar.upsertMatter, { ...base, title: "A resolution relating to a grant." });
    expect(await locs(t)).toHaveLength(0);
    await t.mutation(internal.legistar.upsertMatter, base);
    expect(await locs(t)).toHaveLength(1);
    await t.mutation(internal.legistar.setMatterParcels, { matterId: 1, parcels: [parcel(null)] });
    expect(await locs(t)).toHaveLength(0);
    await t.mutation(internal.legistar.setMatterParcels, { matterId: 1, parcels: [near(0.1)] });
    await t.mutation(internal.legistar.setMatterParcels, { matterId: 1 });
    expect(await locs(t)).toHaveLength(0);
  });
  it("backfill rebuilds rows from existing matters, idempotently, in batches", async () => {
    const t = convexTest(schema, modules);
    for (const id of [1, 2, 3]) {
      await t.mutation(internal.legistar.upsertMatter, { ...base, legistarId: id, fileNumber: `A${id}` });
      await t.run((ctx) => ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", id)).unique().then((r) => ctx.db.patch(r!._id, { parcels: [near(0.1)] })));
    }
    expect(await locs(t)).toHaveLength(0);
    const first = await t.mutation(internal.locations.backfillMatterLocations, { batch: 2 });
    expect(first.done).toBe(false);
    await t.mutation(internal.locations.backfillMatterLocations, { batch: 2, cursor: first.cursor });
    await t.mutation(internal.locations.backfillMatterLocations, {});
    expect(await locs(t)).toHaveLength(3);
  });
  it("filesNear never reads matters", async () => {
    const t = await seed();
    await t.run(async (ctx) => { for (const m of await ctx.db.query("matters").collect()) await ctx.db.delete(m._id); });
    const r = await t.query(api.near.filesNear, { ...CENTER, filter: "all" });
    expect(r.map((x) => x.fileNumber)).toEqual(["A2", "A7", "A1"]);
  });
});

describe("decided vs all by real statusName", () => {
  it("only finished statuses are decided", async () => {
    const t = convexTest(schema, modules);
    const statuses = ["In Council-Passage", "In Council-Adoption", "Confirmed", "Dead", "Placed On File", "Passed"];
    for (const [i, s] of statuses.entries()) {
      await t.mutation(internal.legistar.upsertMatter, { legistarId: 10 + i, fileNumber: `S${i}`, title: REZ, typeName: "Ordinance", statusName: s });
      await t.mutation(internal.legistar.setMatterParcels, { matterId: 10 + i, parcels: [near(0.1)] });
    }
    const names = async (filter: "decided" | "all") => (await t.query(api.near.filesNear, { ...CENTER, filter })).map((x) => x.statusName).sort();
    expect(await names("decided")).toEqual(["Passed", "Placed On File"]);
    expect(await names("all")).toEqual([...statuses].sort());
  });
});

describe("geocode rate limit", () => {
  const W = 1_000_000 * 60_000;
  it("60 per fixed minute window, 61st refused, next window allowed", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 60; i++) expect(await t.mutation(internal.near.takeGeocodeToken, { now: W + i })).toBe(true);
    expect(await t.mutation(internal.near.takeGeocodeToken, { now: W + 61 })).toBe(false);
    expect(await t.mutation(internal.near.takeGeocodeToken, { now: W + 60_000 })).toBe(true);
  });
  it("public geocode returns busy with no network call once the limit is spent", async () => {
    const t = convexTest(schema, modules);
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      calls.push(String(u));
      return new Response(JSON.stringify({ result: { addressMatches: [] } }));
    });
    for (let i = 0; i < 60; i++) expect(await t.action(api.near.geocode, { text: "1 main st" })).toEqual({ error: "not-found" });
    expect(await t.action(api.near.geocode, { text: "1 main st" })).toEqual({ error: "busy" });
    expect(calls).toHaveLength(60);
    vi.unstubAllGlobals();
  });
});
