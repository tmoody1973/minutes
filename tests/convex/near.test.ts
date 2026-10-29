// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
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
