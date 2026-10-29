import { describe, expect, it } from "vitest";
import { distanceMiles, geocodeUserAddress } from "../../lib/geo/near";

const match = (place: string | null, x = -87.948564295808, y = 42.981547950886, addr = "3473 S 27TH ST, MILWAUKEE, WI, 53215") => ({
  matchedAddress: addr,
  coordinates: { x, y },
  geographies: place ? { "Incorporated Places": [{ NAME: place }] } : {},
});
const stub = (matches: unknown[], calls: string[] = []) => async (url: string, init: RequestInit) => {
  calls.push(`${url}|${JSON.stringify(init.headers)}`);
  return new Response(JSON.stringify({ result: { addressMatches: matches } }));
};

describe("distanceMiles", () => {
  it("haversine, fixed pair to 3 decimals", () => {
    // Milwaukee City Hall to Southgate point; same pair computed independently.
    expect(distanceMiles({ lat: 43.0389, lng: -87.9065 }, { lat: 42.9815, lng: -87.9486 })).toBeCloseTo(4.7, 0);
    expect(distanceMiles({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(69.094, 3);
    expect(distanceMiles({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(0);
  });
});

describe("geocodeUserAddress", () => {
  it("returns lat/lng for a Milwaukee match, sends the honest UA and only the address", async () => {
    const calls: string[] = [];
    const r = await geocodeUserAddress("3473 s 27th st, milwaukee wi", { fetchImpl: stub([match("Milwaukee city")], calls) });
    expect(r).toEqual({ lat: 42.981547950886, lng: -87.948564295808, matchedAddress: "3473 S 27TH ST, MILWAUKEE, WI, 53215" });
    const u = new URL(calls[0].split("|")[0]);
    expect(u.origin + u.pathname).toBe("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
    expect(u.searchParams.get("address")).toBe("3473 s 27th st, milwaukee wi");
    expect(u.searchParams.get("benchmark")).toBe("Public_AR_Current");
    expect(u.searchParams.get("vintage")).toBe("Current_Current");
    expect(u.searchParams.get("layers")).toBe("Incorporated Places");
    expect(calls[0]).toContain("Minutes/0.1 (tarik@radiomilwaukee.org)");
  });
  it("outside-milwaukee for other places or none; not-found for no match", async () => {
    expect(await geocodeUserAddress("123 Main St, Chicago IL", { fetchImpl: stub([match("Chicago city")]) })).toEqual({ error: "outside-milwaukee" });
    expect(await geocodeUserAddress("x", { fetchImpl: stub([match(null)]) })).toEqual({ error: "outside-milwaukee" });
    expect(await geocodeUserAddress("x", { fetchImpl: stub([]) })).toEqual({ error: "not-found" });
  });
  it("several matches: first only if all agree on place", async () => {
    const agree = await geocodeUserAddress("x", { fetchImpl: stub([match("Milwaukee city"), match("Milwaukee city", -87.9, 43)]) });
    expect(agree).toMatchObject({ lat: 42.981547950886 });
    expect(await geocodeUserAddress("x", { fetchImpl: stub([match("Milwaukee city"), match("West Allis city")]) })).toEqual({ error: "not-found" });
  });
  it("rejects empty / too long input without any network call", async () => {
    const calls: string[] = [];
    const f = stub([match("Milwaukee city")], calls);
    expect(await geocodeUserAddress("   ", { fetchImpl: f })).toEqual({ error: "not-found" });
    expect(await geocodeUserAddress("a".repeat(201), { fetchImpl: f })).toEqual({ error: "not-found" });
    expect(calls).toHaveLength(0);
  });
  it("upstream failure or junk body is not-found", async () => {
    expect(await geocodeUserAddress("x", { fetchImpl: async () => new Response("no", { status: 500 }) })).toEqual({ error: "not-found" });
    expect(await geocodeUserAddress("x", { fetchImpl: async () => new Response("{}") })).toEqual({ error: "not-found" });
  });
});
