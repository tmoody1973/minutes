import { describe, expect, it, vi } from "vitest";
import { fetchParcelPolygon, InvalidAddressError, lookupParcel, lookupParcels, polygonCentroid } from "@/lib/geo/mprop";
import type { Address } from "@/lib/geo/address";

import southgate from "../../fixtures/mprop/mprop-southgate.json";
import kilbourn from "../../fixtures/mprop/mprop-kilbourn.json";
import parcel5331104000 from "../../fixtures/mprop/parcel-5331104000.json";
import parcel3930942000 from "../../fixtures/mprop/parcel-3930942000.json";

const SOUTHGATE: Address = { houseNumber: 3473, dir: "S", street: "27TH", type: "ST" };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

// A fetch double: MPROP answers `mprop`, the parcel service answers `parcel`.
function fakeFetch(mprop: unknown, parcel: unknown = { features: [] }) {
  return vi.fn(async (url: string) => ok(url.includes("milwaukeemaps") ? parcel : mprop));
}

describe("lookupParcel", () => {
  it("3473 S 27TH resolves through the range 3441-3473 to the Southgate parcel", async () => {
    const fetchImpl = fakeFetch(southgate);
    expect(await lookupParcel(SOUTHGATE, { fetchImpl })).toEqual({
      taxkey: "5331104000",
      zoning: "PD",
      alder: 11,
      lotAreaSqFt: 201334.32,
      owner: "SOUTHGATE MARKETPLACE LLC",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url);
    expect(u.pathname).toBe("/api/3/action/datastore_search");
    expect(u.searchParams.get("resource_id")).toBe("0a2c7f31-cd15-4151-8222-09dd57d5f16d");
    expect(JSON.parse(u.searchParams.get("filters")!)).toEqual({ STREET: "27TH", SDIR: "S" });
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("Minutes/0.1 (tarik@radiomilwaukee.org)");
  });

  it("no row covers the number: null, never the nearest house number", async () => {
    // Fixture rows are 3441-3473, 5584, 5940, 2465; 3475 is just past the Southgate range.
    expect(await lookupParcels({ ...SOUTHGATE, houseNumber: 3475 }, { fetchImpl: fakeFetch(southgate) })).toEqual([]);
    expect(await lookupParcel({ ...SOUTHGATE, houseNumber: 3475 }, { fetchImpl: fakeFetch(southgate) })).toBeNull();
  });

  it("a street type that differs does not match", async () => {
    expect(await lookupParcels({ ...SOUTHGATE, type: "AV" }, { fetchImpl: fakeFetch(southgate) })).toEqual([]);
  });

  it("several parcels covering the number are all returned; lookupParcel then refuses to pick one", async () => {
    const two = { result: { total: 2, records: [...southgate.result.records.slice(0, 1), { ...southgate.result.records[0], TAXKEY: "5331104001" }] } };
    const found = await lookupParcels(SOUTHGATE, { fetchImpl: fakeFetch(two) });
    expect(found.map((p) => p.taxkey)).toEqual(["5331104000", "5331104001"]);
    expect(await lookupParcel(SOUTHGATE, { fetchImpl: fakeFetch(two) })).toBeNull();
  });

  it("an address range matches parcels overlapping it", async () => {
    const range = { ...SOUTHGATE, houseNumber: 3470, houseNumberHigh: 3480 };
    expect((await lookupParcels(range, { fetchImpl: fakeFetch(southgate) })).map((p) => p.taxkey)).toEqual(["5331104000"]);
  });

  it("pages with offset until total is reached", async () => {
    const rec = (n: number) => ({ ...southgate.result.records[0], TAXKEY: String(n), HOUSE_NR_LO: "1", HOUSE_NR_HI: "1" });
    const page1 = { result: { total: 3, records: [rec(1), rec(2)] } };
    const page2 = { result: { total: 3, records: [{ ...southgate.result.records[0] }] } };
    const fetchImpl = vi.fn(async (url: string) => ok(new URL(url).searchParams.get("offset") === "2" ? page2 : page1));
    const found = await lookupParcels(SOUTHGATE, { fetchImpl, pageSize: 2 });
    expect(found.map((p) => p.taxkey)).toEqual(["5331104000"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("an upstream error throws instead of looking like 'no parcel'", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));
    await expect(lookupParcels(SOUTHGATE, { fetchImpl })).rejects.toThrow(/500/);
  });
});

describe("input validation (before any network call)", () => {
  const bad: Address[] = [
    { houseNumber: 1, dir: "S", street: "27TH'; DROP TABLE x;--" },
    { houseNumber: 0, dir: "S", street: "27TH" },
    { houseNumber: 100000, dir: "S", street: "27TH" },
    { houseNumber: 1.5, dir: "S", street: "27TH" },
    { houseNumber: 5, dir: "X" as never, street: "27TH" },
    { houseNumber: 5, dir: "S", street: "" },
    { houseNumber: 5, dir: "S", street: "a".repeat(41) },
    { houseNumber: 5, dir: "S", street: "lower" },
  ];
  it.each(bad.map((a) => [JSON.stringify(a), a] as const))("rejects %s", async (_n, a) => {
    const fetchImpl = vi.fn();
    await expect(lookupParcels(a, { fetchImpl })).rejects.toBeInstanceOf(InvalidAddressError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("accepts hyphen and digits in street names", async () => {
    await expect(lookupParcels({ houseNumber: 5, dir: "N", street: "MARTIN LUTHER KING-JR" }, { fetchImpl: fakeFetch({ result: { total: 0, records: [] } }) })).resolves.toEqual([]);
  });
});

describe("fetchParcelPolygon", () => {
  it("returns the 10-vertex Southgate lot ring and queries by TAXKEY in WGS84 GeoJSON", async () => {
    const fetchImpl = fakeFetch(null, parcel5331104000);
    const g = await fetchParcelPolygon("5331104000", { fetchImpl });
    expect(g?.type).toBe("Polygon");
    expect(g?.coordinates[0]).toHaveLength(10);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url);
    expect(u.pathname).toBe("/arcgis/rest/services/property/parcels_mprop/MapServer/2/query");
    expect(u.searchParams.get("where")).toBe("TAXKEY='5331104000'");
    expect(u.searchParams.get("outSR")).toBe("4326");
    expect(u.searchParams.get("f")).toBe("geojson");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("Minutes/0.1 (tarik@radiomilwaukee.org)");
  });
  it("no feature: null", async () => {
    expect(await fetchParcelPolygon("5331104000", { fetchImpl: fakeFetch(null, { type: "FeatureCollection", features: [] }) })).toBeNull();
  });
  it("more than one feature: null (will not guess which lot)", async () => {
    const f = parcel5331104000.features[0];
    expect(await fetchParcelPolygon("5331104000", { fetchImpl: fakeFetch(null, { features: [f, f] }) })).toBeNull();
  });
  it("malformed taxkey throws before any network call", async () => {
    const fetchImpl = vi.fn();
    for (const k of ["5331104000' OR '1'='1", "123", "533110400A", ""]) {
      await expect(fetchParcelPolygon(k, { fetchImpl })).rejects.toBeInstanceOf(InvalidAddressError);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("polygonCentroid", () => {
  it("is the bbox center of the outer ring(s), as {lat,lng}", () => {
    const g = parcel3930942000.features[0].geometry as GeoJSON.Polygon;
    const xs = g.coordinates[0].map((c) => c[0]);
    const ys = g.coordinates[0].map((c) => c[1]);
    expect(polygonCentroid(g)).toEqual({ lng: (Math.min(...xs) + Math.max(...xs)) / 2, lat: (Math.min(...ys) + Math.max(...ys)) / 2 });
  });
  it("handles a MultiPolygon", () => {
    const g: GeoJSON.MultiPolygon = { type: "MultiPolygon", coordinates: [[[[0, 0], [2, 0], [2, 2], [0, 0]]], [[[4, 4], [6, 4], [6, 6], [4, 4]]]] };
    expect(polygonCentroid(g)).toEqual({ lng: 3, lat: 3 });
  });
});

describe("kilbourn fixture", () => {
  it("711 E KILBOURN: PD, alder 4", async () => {
    const p = await lookupParcel({ houseNumber: 711, dir: "E", street: "KILBOURN", type: "AV" }, { fetchImpl: fakeFetch(kilbourn) });
    expect(p).toMatchObject({ taxkey: "3930942000", zoning: "PD", alder: 4 });
  });
});

describe("resolveParcels", () => {
  it("joins address -> lot -> outline and centroid", async () => {
    const { resolveParcels } = await import("@/lib/geo/mprop");
    const { parcels, errors } = await resolveParcels([SOUTHGATE], { fetchImpl: fakeFetch(southgate, parcel5331104000) });
    expect(errors).toEqual([]);
    expect(parcels).toHaveLength(1);
    expect(parcels[0]).toMatchObject({ taxkey: "5331104000", address: "3473 S 27TH ST", zoning: "PD", alder: 11 });
    expect(parcels[0].polygon?.type).toBe("Polygon");
    expect(parcels[0].centroid).toEqual(polygonCentroid(parcels[0].polygon!));
  });
  it("one failing address is reported and the rest still resolve", async () => {
    const { resolveParcels } = await import("@/lib/geo/mprop");
    const bad: Address = { houseNumber: 1, dir: "S", street: "x'--" };
    const { parcels, errors } = await resolveParcels([bad, SOUTHGATE], { fetchImpl: fakeFetch(southgate, parcel5331104000) });
    expect(parcels.map((p) => p.taxkey)).toEqual(["5331104000"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^address 1 S x'--: /);
  });
  it("a polygon failure keeps the lot with no outline", async () => {
    const { resolveParcels } = await import("@/lib/geo/mprop");
    const fetchImpl = vi.fn(async (url: string) => (url.includes("milwaukeemaps") ? new Response("x", { status: 503 }) : ok(southgate)));
    const { parcels, errors } = await resolveParcels([SOUTHGATE], { fetchImpl });
    expect(parcels[0]).toMatchObject({ taxkey: "5331104000", polygon: null, centroid: null });
    expect(errors[0]).toMatch(/^polygon 5331104000/);
  });
});
