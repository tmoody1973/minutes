// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import matter74560 from "../fixtures/legistar/matter-74560.json";
import southgate from "../fixtures/mprop/mprop-southgate.json";
import parcel5331104000 from "../fixtures/mprop/parcel-5331104000.json";

const modules = import.meta.glob("../../convex/**/*.ts");
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const SOUTH_TITLE = "A substitute ordinance relating to a change in zoning at 3473 South 27th Street, in the 11th Aldermanic District.";

// Routes Legistar (webapi), MPROP (data.milwaukee.gov) and the parcel map by host.
function stubFetch(title: string, opts: { mprop?: () => Response; parcel?: () => Response } = {}) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("webapi.legistar.com")) {
      if (url.endsWith("/attachments") || url.endsWith("/histories")) return json([]);
      return json({ ...matter74560, MatterId: 74560, MatterTitle: title });
    }
    if (url.includes("data.milwaukee.gov")) return opts.mprop?.() ?? json(southgate);
    return opts.parcel?.() ?? json(parcel5331104000);
  });
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

const old = { taxkey: "OLD0000000", address: "1 N OLD ST", zoning: "R1", alder: 1, lotAreaSqFt: 5, owner: "O", polygon: null, centroid: null };
async function seeded(title = SOUTH_TITLE) {
  const t = convexTest(schema, modules);
  await t.mutation(internal.legistar.upsertMatter, { legistarId: 74560, fileNumber: "260533", title, typeName: "Ordinance", statusName: "In Committee" });
  // Direct patch: setMatterParcels would stamp parcelsCheckedAt, and these tests start from a never-checked matter.
  await t.run(async (ctx) => { const m = await ctx.db.query("matters").first(); await ctx.db.patch(m!._id, { parcels: [old] }); });
  return t;
}
const row = (t: Awaited<ReturnType<typeof seeded>>) => t.run((ctx) => ctx.db.query("matters").first());
const runs = (t: Awaited<ReturnType<typeof seeded>>) => t.run((ctx) => ctx.db.query("syncRuns").collect());

describe("syncMatter parcels", () => {
  it("a full success replaces parcels and stamps the matter", async () => {
    stubFetch(SOUTH_TITLE);
    const t = await seeded();
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    const m = await row(t);
    expect(m?.parcels).toHaveLength(1);
    expect(m?.parcels?.[0]).toMatchObject({ taxkey: "5331104000", address: "3473 S 27TH ST", zoning: "PD", alder: 11 });
    expect(m?.syncedAt).toBeTypeOf("number");
  });

  it("partial failure keeps the stored parcels and leaves the matter unstamped", async () => {
    stubFetch(SOUTH_TITLE, { mprop: () => json("boom", 500) });
    const t = await seeded();
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    const m = await row(t);
    expect(m?.parcels).toEqual([old]);
    expect(m?.syncedAt).toBeUndefined();
    expect((await runs(t))[0]).toMatchObject({ ok: false });
  });

  it("a polygon failure does not overwrite a stored good lot", async () => {
    stubFetch(SOUTH_TITLE, { parcel: () => json("down", 503) });
    const t = await seeded();
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    expect((await row(t))?.parcels).toEqual([old]);
  });

  it("a title with no addresses clears parcels", async () => {
    stubFetch("A resolution honoring a retiring staff member.");
    const t = await seeded("old");
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    const m = await row(t);
    expect(m?.parcels).toBeUndefined();
    expect(m?.syncedAt).toBeTypeOf("number");
  });

  it("an InvalidAddressError is a logged skip: no error row, matter still stamped, no network lookup", async () => {
    const calls = stubFetch("A resolution at 100-399 East Foo Street.");
    const t = await seeded("old");
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    const m = await row(t);
    expect(m?.parcels).toEqual([]);
    expect(m?.syncedAt).toBeTypeOf("number");
    expect(await runs(t)).toEqual([]);
    expect(calls.some((u) => u.includes("data.milwaukee.gov"))).toBe(false);
  });
});

describe("syncMatter politeness (Ruling 40)", () => {
  const cityCalls = (calls: string[]) => calls.filter((u) => u.includes("data.milwaukee.gov") || u.includes("milwaukeemaps")).length;
  const DAY = 86_400_000;
  const stamp = (t: Awaited<ReturnType<typeof seeded>>, at: number) =>
    t.run(async (ctx) => { const m = await ctx.db.query("matters").first(); await ctx.db.patch(m!._id, { parcelsCheckedAt: at }); });

  it("same title and a fresh check: no MPROP or parcel-map calls, parcels kept", async () => {
    const calls = stubFetch(SOUTH_TITLE);
    const t = await seeded();
    await stamp(t, Date.now() - DAY);
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    expect(cityCalls(calls)).toBe(0);
    expect((await row(t))?.parcels).toEqual([old]);
    expect((await row(t))?.syncedAt).toBeTypeOf("number");
  });
  it("a changed title resolves again", async () => {
    const calls = stubFetch(SOUTH_TITLE);
    const t = await seeded("older title");
    await stamp(t, Date.now() - DAY);
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    expect(cityCalls(calls)).toBeGreaterThan(0);
    expect((await row(t))?.parcels?.[0]).toMatchObject({ taxkey: "5331104000" });
  });
  it("never looked up (no parcelsCheckedAt) resolves, and stamps parcelsCheckedAt", async () => {
    const calls = stubFetch(SOUTH_TITLE);
    const t = await seeded();
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    expect(cityCalls(calls)).toBeGreaterThan(0);
    expect((await row(t))?.parcelsCheckedAt).toBeGreaterThan(Date.now() - 60_000);
  });
  it("a check older than 7 days resolves again", async () => {
    const calls = stubFetch(SOUTH_TITLE);
    const t = await seeded();
    await stamp(t, Date.now() - 8 * DAY);
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    expect(cityCalls(calls)).toBeGreaterThan(0);
  });
  it("a failed resolve does not stamp parcelsCheckedAt", async () => {
    stubFetch(SOUTH_TITLE, { mprop: () => json("boom", 500) });
    const t = await seeded();
    await t.action(internal.sync.syncMatter, { matterId: 74560, force: true });
    expect((await row(t))?.parcelsCheckedAt).toBeUndefined();
  });
});
