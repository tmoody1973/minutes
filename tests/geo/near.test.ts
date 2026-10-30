import { describe, expect, it } from "vitest";
import { distanceMiles, geocodeTyped, geocodeUserAddress } from "../../lib/geo/near";
import kilbourn from "../fixtures/mprop/mprop-kilbourn.json";
import southgate from "../fixtures/mprop/mprop-southgate.json";
import parcel3930942000 from "../fixtures/mprop/parcel-3930942000.json";

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
  it("Census outage (5xx, timeout, network) is unavailable, not a bad address", async () => {
    expect(await geocodeUserAddress("x", { fetchImpl: async () => new Response("no", { status: 502 }) })).toEqual({ error: "unavailable" });
    expect(await geocodeUserAddress("x", { fetchImpl: async () => { throw new DOMException("timed out", "TimeoutError"); } })).toEqual({ error: "unavailable" });
    expect(await geocodeUserAddress("x", { fetchImpl: async () => { throw new TypeError("fetch failed"); } })).toEqual({ error: "unavailable" });
  });
  it("a 4xx or junk body is still not-found", async () => {
    expect(await geocodeUserAddress("x", { fetchImpl: async () => new Response("no", { status: 400 }) })).toEqual({ error: "not-found" });
    expect(await geocodeUserAddress("x", { fetchImpl: async () => new Response("{}") })).toEqual({ error: "not-found" });
  });
  it("a street-only address is looked up in Milwaukee, WI (Census finds nothing without a city)", async () => {
    const sent = async (text: string) => {
      const calls: string[] = [];
      await geocodeUserAddress(text, { fetchImpl: stub([match("Milwaukee city")], calls) });
      return new URL(calls[0].split("|")[0]).searchParams.get("address");
    };
    expect(await sent("711 E Kilbourn Ave")).toBe("711 E Kilbourn Ave, Milwaukee, WI");
    expect(await sent("711 E Kilbourn Ave Milwaukee")).toBe("711 E Kilbourn Ave Milwaukee");
    expect(await sent("711 E Kilbourn Ave, WI")).toBe("711 E Kilbourn Ave, WI");
    expect(await sent("711 E Kilbourn Ave 53202")).toBe("711 E Kilbourn Ave 53202");
    expect(await sent("7700 W Wisconsin Ave")).toBe("7700 W Wisconsin Ave, Milwaukee, WI");
  });
});

describe("geocodeTyped: city records first, Census as fallback", () => {
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  // Routes the city's MPROP (data.milwaukee.gov), the parcel map (milwaukeemaps) and Census by host; records hosts.
  const route = (mprop: () => Response, census = () => json({ result: { addressMatches: [match("Milwaukee city")] } })) => {
    const hosts: string[] = [];
    const fetchImpl = async (url: string) => {
      const host = new URL(url).host;
      hosts.push(host);
      if (host === "data.milwaukee.gov") return mprop();
      if (host === "milwaukeemaps.milwaukee.gov") return json(parcel3930942000);
      return census();
    };
    return { hosts, fetchImpl };
  };

  it("a parsed address found in city records uses the lot's center and alder district, no Census call", async () => {
    const { hosts, fetchImpl } = route(() => json(kilbourn));
    const r = await geocodeTyped("711 E Kilbourn Ave", { fetchImpl });
    expect(r).toMatchObject({ matchedAddress: "711 E KILBOURN AV, MILWAUKEE, WI", district: 4 });
    expect("lat" in r && Math.abs(r.lat - 43.0425) < 0.001 && Math.abs(r.lng + 87.9028) < 0.001).toBe(true);
    expect(hosts).not.toContain("geocoding.geo.census.gov");
  });
  it("no lot at that number falls back to Census", async () => {
    const { hosts, fetchImpl } = route(() => json(southgate));
    expect(await geocodeTyped("711 E Kilbourn Ave", { fetchImpl })).toMatchObject({ matchedAddress: "3473 S 27TH ST, MILWAUKEE, WI, 53215" });
    expect(hosts).toContain("geocoding.geo.census.gov");
  });
  it("a city service failure falls back to Census", async () => {
    const { hosts, fetchImpl } = route(() => json("down", 503));
    expect(await geocodeTyped("711 E Kilbourn Ave", { fetchImpl })).toMatchObject({ lat: 42.981547950886 });
    expect(hosts).toContain("geocoding.geo.census.gov");
  });
  it("text the parser cannot read goes straight to Census", async () => {
    const { hosts, fetchImpl } = route(() => json(kilbourn));
    await geocodeTyped("Kilbourn and Van Buren", { fetchImpl });
    expect(hosts).toEqual(["geocoding.geo.census.gov"]);
  });
});
