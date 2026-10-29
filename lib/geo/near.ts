const USER_AGENT = "Minutes/0.1 (tarik@radiomilwaukee.org)";
const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const EARTH_RADIUS_MI = 3958.8;
export const MAX_GEOCODE_INPUT = 200;
const TIMEOUT_MS = 15_000;

export interface LatLng {
  lat: number;
  lng: number;
}

export type GeocodeResult = (LatLng & { matchedAddress: string }) | { error: "not-found" | "outside-milwaukee" };

/** Great-circle distance in miles (haversine). */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface GeocodeOptions {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
}

interface CensusMatch {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
  geographies?: Record<string, { NAME?: string }[] | undefined>;
}

const placeOf = (m: CensusMatch): string | null => m.geographies?.["Incorporated Places"]?.[0]?.NAME ?? null;

/**
 * Typed address -> point, via the US Census one-line geocoder only (nothing else is sent, no MPROP lookup).
 * Several matches: the first is used only if every match is in the same place, otherwise "not-found" (ambiguous).
 */
export async function geocodeUserAddress(text: string, opts: GeocodeOptions = {}): Promise<GeocodeResult> {
  const address = text.trim();
  if (!address || address.length > MAX_GEOCODE_INPUT) return { error: "not-found" };
  const fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const qs = new URLSearchParams({ address, benchmark: "Public_AR_Current", vintage: "Current_Current", layers: "Incorporated Places", format: "json" });
  let matches: CensusMatch[];
  try {
    const res = await fetchImpl(`${CENSUS_URL}?${qs}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { error: "not-found" };
    const body = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } };
    matches = body.result?.addressMatches ?? [];
  } catch {
    // Deliberately not logged: the message could carry the typed address.
    return { error: "not-found" };
  }
  const first = matches[0];
  const { x, y } = first?.coordinates ?? {};
  if (!first || typeof x !== "number" || typeof y !== "number" || !first.matchedAddress) return { error: "not-found" };
  if (matches.some((m) => placeOf(m) !== placeOf(first))) return { error: "not-found" };
  if (placeOf(first) !== "Milwaukee city") return { error: "outside-milwaukee" };
  return { lat: y, lng: x, matchedAddress: first.matchedAddress };
}
