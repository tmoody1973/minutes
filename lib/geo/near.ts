import { parseTypedAddress } from "./address";
import { resolveParcels } from "./mprop";

const USER_AGENT = "Minutes/0.1 (tarik@radiomilwaukee.org)";
const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const EARTH_RADIUS_MI = 3958.8;
export const MAX_GEOCODE_INPUT = 200;
const TIMEOUT_MS = 15_000;

export interface LatLng {
  lat: number;
  lng: number;
}

// "unavailable": Census failed (5xx, timeout, network), so the address itself may be fine.
export type GeocodeResult = (LatLng & { matchedAddress: string; district?: number }) | { error: "not-found" | "outside-milwaukee" | "unavailable" };

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

// Census returns nothing for a street-only line. Minutes covers one city, so a line naming no city, state or ZIP
// is looked up in Milwaukee; "Wisconsin Ave" is a street, not the state. outside-milwaukee still guards other cities.
// Any comma counts as naming a place ("..., Wauwatosa"), so a place the resident typed is never overridden.
const NAMES_PLACE = /,|\bmilwaukee\b|\bwi\s*$|\b\d{5}(?:-\d{4})?\s*$/i;
const withCity = (address: string) => (NAMES_PLACE.test(address) ? address : `${address}, Milwaukee, WI`);

const placeOf = (m: CensusMatch): string | null => m.geographies?.["Incorporated Places"]?.[0]?.NAME ?? null;

/**
 * Typed address -> point, via the US Census one-line geocoder only (nothing else is sent, no MPROP lookup).
 * Several matches: the first is used only if every match is in the same place, otherwise "not-found" (ambiguous).
 */
export async function geocodeUserAddress(text: string, opts: GeocodeOptions = {}): Promise<GeocodeResult> {
  const address = text.trim();
  if (!address || address.length > MAX_GEOCODE_INPUT) return { error: "not-found" };
  const fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const qs = new URLSearchParams({ address: withCity(address), benchmark: "Public_AR_Current", vintage: "Current_Current", layers: "Incorporated Places", format: "json" });
  let matches: CensusMatch[];
  try {
    const res = await fetchImpl(`${CENSUS_URL}?${qs}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 500) return { error: "unavailable" };
    if (!res.ok) return { error: "not-found" };
    const body = (await res.json().catch(() => ({}))) as { result?: { addressMatches?: CensusMatch[] } };
    matches = body.result?.addressMatches ?? [];
  } catch {
    // Network failure or timeout. Deliberately not logged: the message could carry the typed address.
    return { error: "unavailable" };
  }
  const first = matches[0];
  const { x, y } = first?.coordinates ?? {};
  if (!first || typeof x !== "number" || typeof y !== "number" || !first.matchedAddress) return { error: "not-found" };
  if (matches.some((m) => placeOf(m) !== placeOf(first))) return { error: "not-found" };
  if (placeOf(first) !== "Milwaukee city") return { error: "outside-milwaukee" };
  return { lat: y, lng: x, matchedAddress: first.matchedAddress };
}

const CITY_TIMEOUT_MS = 5_000;

// City records cover Milwaukee only. A typed other city ("..., Pewaukee, WI") or a non-532xx ZIP must not be
// matched to a same-named Milwaukee street, so those go straight to Census (which can say outside-milwaukee).
function mayBeMilwaukee(text: string): boolean {
  const zip = /\b(\d{5})(?:-\d{4})?\s*$/.exec(text)?.[1];
  if (zip && !zip.startsWith("532")) return false;
  const rest = text.split(",").slice(1).join(" ").trim();
  return !rest || /^(?:milwaukee)?[\s,]*(?:wi|wisconsin)?[\s,]*(?:\d{5}(?:-\d{4})?)?$/i.test(rest);
}

/**
 * City records first (decision 006): a parsed address that matches one lot in MPROP returns that lot's center and
 * alder district. Anything else (unparsed text, no lot, a city service failure) falls back to the Census geocoder.
 */
export async function geocodeTyped(text: string, opts: GeocodeOptions = {}): Promise<GeocodeResult> {
  const typed = mayBeMilwaukee(text) ? parseTypedAddress(text) : null;
  if (typed) {
    // A person is waiting: city calls get 5 s each (the sync job's 20 s would stack to nearly a minute).
    const base = opts.fetchImpl ?? ((u: string, i: RequestInit) => fetch(u, i));
    const quick = (u: string, i: RequestInit) =>
      base(u, { ...i, signal: AbortSignal.any([AbortSignal.timeout(CITY_TIMEOUT_MS), ...(i.signal ? [i.signal] : [])]) });
    try {
      const { parcels, errors } = await resolveParcels([typed], { fetchImpl: quick });
      const lot = errors.length ? undefined : parcels.find((p) => p.centroid);
      if (lot?.centroid) {
        return { ...lot.centroid, matchedAddress: `${lot.address}, MILWAUKEE, WI`, ...(lot.alder !== null && { district: lot.alder }) };
      }
    } catch {
      // Deliberately not logged (could carry the address); Census gets a turn.
    }
  }
  return geocodeUserAddress(text, opts);
}
