import type { Address } from "./address";

const USER_AGENT = "Minutes/0.1 (tarik@radiomilwaukee.org)";
const CKAN_URL = "https://data.milwaukee.gov/api/3/action/datastore_search";
const MPROP_RESOURCE = "0a2c7f31-cd15-4151-8222-09dd57d5f16d";
const PARCEL_URL = "https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/property/parcels_mprop/MapServer/2/query";
const TIMEOUT_MS = 20_000;
const PAGE_SIZE = 5000;
const FIELDS = "TAXKEY,HOUSE_NR_LO,HOUSE_NR_HI,SDIR,STREET,STTYPE,ZONING,GEO_ALDER,LOT_AREA,OWNER_NAME_1";

export class InvalidAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAddressError";
  }
}

export interface Parcel {
  taxkey: string;
  zoning: string;
  /** null when MPROP has no alder district for the parcel. */
  alder: number | null;
  /** MPROP LOT_AREA; 0 means MPROP has no area on file. */
  lotAreaSqFt: number;
  owner: string;
}

// Injectable so tests never touch the network.
export interface MpropOptions {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  pageSize?: number;
}

async function getJson(url: string, fetchImpl: NonNullable<MpropOptions["fetchImpl"]>): Promise<unknown> {
  // ponytail: no retries; the caller records the failure and the next sync tries again.
  const res = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return res.json();
}

function validate(a: Address): void {
  if (!Number.isInteger(a.houseNumber) || a.houseNumber < 1 || a.houseNumber > 99999) throw new InvalidAddressError(`bad house number: ${a.houseNumber}`);
  if (a.houseNumberHigh !== undefined && (!Number.isInteger(a.houseNumberHigh) || a.houseNumberHigh < a.houseNumber || a.houseNumberHigh > 99999)) {
    throw new InvalidAddressError(`bad house number range end: ${a.houseNumberHigh}`);
  }
  if (!["N", "S", "E", "W"].includes(a.dir)) throw new InvalidAddressError(`bad direction: ${a.dir}`);
  if (!/^[A-Z0-9 -]{1,40}$/.test(a.street)) throw new InvalidAddressError(`bad street: ${a.street}`);
  if (a.type !== undefined && !/^[A-Z]{1,4}$/.test(a.type)) throw new InvalidAddressError(`bad street type: ${a.type}`);
}

type Row = Record<string, string | null>;

async function fetchStreetRows(a: Address, fetchImpl: NonNullable<MpropOptions["fetchImpl"]>, pageSize: number): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const q = new URLSearchParams({
      resource_id: MPROP_RESOURCE,
      filters: JSON.stringify({ STREET: a.street, SDIR: a.dir }),
      fields: FIELDS,
      limit: String(pageSize),
      offset: String(offset),
    });
    const body = (await getJson(`${CKAN_URL}?${q}`, fetchImpl)) as { result?: { total?: number; records?: Row[] } };
    const page = body.result?.records;
    if (!Array.isArray(page)) throw new Error("MPROP response had no records array");
    rows.push(...page);
    if (!page.length || rows.length >= (body.result?.total ?? 0)) return rows;
  }
}

const toParcel = (r: Row): Parcel => ({
  taxkey: String(r.TAXKEY),
  zoning: r.ZONING ?? "",
  alder: r.GEO_ALDER && Number.isFinite(Number(r.GEO_ALDER)) ? Number(r.GEO_ALDER) : null,
  lotAreaSqFt: Number(r.LOT_AREA ?? 0) || 0,
  owner: r.OWNER_NAME_1 ?? "",
});

/**
 * Every MPROP parcel whose house-number range covers the address (for an address range, overlaps it) on the
 * same street/direction (and type, when the address has one). Empty when none: we never fall back to the
 * nearest number. A range can cover several parcels, so this returns all of them.
 */
export async function lookupParcels(a: Address, { fetchImpl = fetch, pageSize = PAGE_SIZE }: MpropOptions = {}): Promise<Parcel[]> {
  validate(a);
  const lo = a.houseNumber;
  const hi = a.houseNumberHigh ?? a.houseNumber;
  const seen = new Set<string>();
  const out: Parcel[] = [];
  for (const r of await fetchStreetRows(a, fetchImpl, pageSize)) {
    const rLo = Number.parseInt(r.HOUSE_NR_LO ?? "", 10);
    const rHi = Number.parseInt(r.HOUSE_NR_HI ?? "", 10);
    if (!Number.isInteger(rLo) || !Number.isInteger(rHi) || rLo > hi || rHi < lo) continue;
    if (a.type && r.STTYPE !== a.type) continue;
    const p = toParcel(r);
    if (!/^\d{10}$/.test(p.taxkey) || seen.has(p.taxkey)) continue;
    seen.add(p.taxkey);
    out.push(p);
  }
  return out;
}

/** The one parcel at the address; null if none OR more than one (we do not pick between lots). */
export async function lookupParcel(a: Address, opts?: MpropOptions): Promise<Parcel | null> {
  const found = await lookupParcels(a, opts);
  return found.length === 1 ? found[0] : null;
}

export type ParcelGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

/** The city's own lot outline (WGS84) for a tax key; null unless exactly one feature comes back. */
export async function fetchParcelPolygon(taxkey: string, { fetchImpl = fetch }: MpropOptions = {}): Promise<ParcelGeometry | null> {
  // The tax key is the only value interpolated into the query, so it is checked first.
  if (!/^\d{10}$/.test(taxkey)) throw new InvalidAddressError(`bad tax key: ${taxkey}`);
  const q = new URLSearchParams({ where: `TAXKEY='${taxkey}'`, outFields: "TAXKEY", outSR: "4326", f: "geojson" });
  const body = (await getJson(`${PARCEL_URL}?${q}`, fetchImpl)) as { features?: { geometry?: ParcelGeometry | null }[]; error?: unknown };
  if (body.error) throw new Error(`parcel service error: ${JSON.stringify(body.error)}`);
  const g = body.features?.length === 1 ? body.features[0].geometry : null;
  return g && (g.type === "Polygon" || g.type === "MultiPolygon") ? g : null;
}

/** Center of the bounding box of the outer ring(s). Cheap and good enough for "near me" distance; for a
 *  concave lot it can fall just outside the outline, so do not draw it as a pin on the lot. */
export function polygonCentroid(g: ParcelGeometry): { lat: number; lng: number } {
  const rings = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
  const pts = rings.flat();
  const xs = pts.map((c) => c[0]);
  const ys = pts.map((c) => c[1]);
  return { lng: (Math.min(...xs) + Math.max(...xs)) / 2, lat: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

export interface MatterParcel extends Parcel {
  /** The title address that resolved to this lot, e.g. "3473 S 27TH ST". */
  address: string;
  polygon: ParcelGeometry | null;
  centroid: { lat: number; lng: number } | null;
}

const addressText = (a: Address) =>
  `${a.houseNumber}${a.houseNumberHigh ? `-${a.houseNumberHigh}` : ""} ${a.dir} ${a.street}${a.type ? ` ${a.type}` : ""}`;

/**
 * Resolves every title address to its lot(s). One address failing never loses the others: failures are
 * returned as `errors` for the caller to record. A lot whose outline can't be fetched or is ambiguous is kept
 * with polygon/centroid null (no outline beats a wrong outline).
 */
export async function resolveParcels(
  addresses: Address[],
  opts?: MpropOptions,
): Promise<{ parcels: MatterParcel[]; errors: string[] }> {
  const parcels: MatterParcel[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const a of addresses) {
    const label = addressText(a);
    try {
      for (const p of await lookupParcels(a, opts)) {
        if (seen.has(p.taxkey)) continue;
        seen.add(p.taxkey);
        let polygon: ParcelGeometry | null = null;
        try {
          polygon = await fetchParcelPolygon(p.taxkey, opts);
        } catch (err) {
          errors.push(`polygon ${p.taxkey}: ${err instanceof Error ? err.message : String(err)}`);
        }
        parcels.push({ ...p, address: label, polygon, centroid: polygon ? polygonCentroid(polygon) : null });
      }
    } catch (err) {
      errors.push(`address ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { parcels, errors };
}
