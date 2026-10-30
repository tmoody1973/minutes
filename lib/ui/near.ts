// Display helpers for the Near me page (mockup MinLaptopTracker). Pure: safe in client and server code.
import { type Address, extractAddresses } from "../geo/address";
import { label as timelineLabel } from "../timeline/build";

export type NearFilter = "upcoming" | "decided" | "all";

// Labels and order from the mockup's filter chips.
export const FILTERS: readonly { id: NearFilter; label: string }[] = [
  { id: "upcoming", label: "Upcoming hearings" },
  { id: "decided", label: "Decided" },
  { id: "all", label: "All" },
];

// MPROP street-type codes (lib/geo/address.ts TYPES) as people write them.
const TYPE_ABBR: Record<string, string> = {
  AV: "Ave.", ST: "St.", PL: "Pl.", BL: "Blvd.", DR: "Dr.", RD: "Rd.", CT: "Ct.", LA: "Ln.", PK: "Pkwy.", WY: "Way", TR: "Ter.",
};

// "VAN BUREN" -> "Van Buren", "27TH" -> "27th".
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());

function formatAddress(a: Address): string {
  const num = a.houseNumberHigh ? `${a.houseNumber}-${a.houseNumberHigh}` : String(a.houseNumber);
  const type = a.type ? ` ${TYPE_ABBR[a.type] ?? titleCase(a.type)}` : "";
  return `${num} ${a.dir}. ${titleCase(a.street)}${type}`;
}

// Card heading: the addresses named in the file title, else the file number.
export function placeHeading(title: string, fileNumber: string): string {
  const [first, second, ...rest] = extractAddresses(title);
  if (!first) return `File ${fileNumber}`;
  if (!second) return formatAddress(first);
  if (!rest.length) return `${formatAddress(first)} and ${formatAddress(second)}`;
  return `${formatAddress(first)} and ${rest.length + 1} more`;
}

const KINDS: Record<string, string> = {
  rezoning: "REZONING",
  "dpd-amendment": "DPD AMENDMENT",
  "minor-modification": "MINOR MODIFICATION",
};
export const kindLabel = (kind: string) => KINDS[kind] ?? "ZONING";

// Legistar sends body names in capitals; same labels as the project page timeline.
export const bodyLabel = timelineLabel;

export function hearingLabel(next: { date: string; body: string }): string {
  const day = new Date(next.date).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `Next: ${bodyLabel(next.body)}, ${day}`;
}

const EMPTY: Record<NearFilter, string> = {
  all: "No active files within half a mile.",
  upcoming: "No upcoming hearings within half a mile.",
  decided: "No decided files within half a mile.",
};
export const emptyMessage = (filter: NearFilter) => EMPTY[filter];

export interface SavedPlace {
  lat: number;
  lng: number;
  matchedAddress: string;
  /** Alder district, known when the address matched a lot in city records. */
  district?: number;
}

// The saved place lives only in this browser's storage; anything malformed is treated as no place.
export function parseSavedPlace(raw: string | null): SavedPlace | null {
  if (!raw) return null;
  try {
    const p: unknown = JSON.parse(raw);
    if (typeof p !== "object" || p === null) return null;
    const { lat, lng, matchedAddress, district } = p as Record<string, unknown>;
    if (typeof lat !== "number" || !(lat >= -90 && lat <= 90)) return null;
    if (typeof lng !== "number" || !(lng >= -180 && lng <= 180)) return null;
    if (typeof matchedAddress !== "string" || !matchedAddress || matchedAddress.length > 200) return null;
    const okDistrict = typeof district === "number" && Number.isInteger(district) && district >= 1 && district <= 15;
    return { lat, lng, matchedAddress, ...(okDistrict && { district }) };
  } catch {
    return null;
  }
}

// "711 E KILBOURN AVE, MILWAUKEE, WI, 53202" (Census) or "711 E KILBOURN AV, MILWAUKEE, WI" (city records)
// -> "711 E Kilbourn Ave" for the header chip.
export function shortAddress(matched: string): string {
  const words = titleCase(matched.split(",")[0].trim()).replace(/\b(N|S|E|W)\b/gi, (d) => d.toUpperCase()).split(" ");
  const type = TYPE_ABBR[words[words.length - 1].toUpperCase()];
  if (type) words[words.length - 1] = type.replace(/\.$/, "");
  return words.join(" ");
}

export const chipText = (p: SavedPlace) => (p.district ? `${shortAddress(p.matchedAddress)} · District ${p.district}` : shortAddress(p.matchedAddress));

// filesNear rounds to 0.01 mi; 0 means the searched address is on the project lot.
export const distanceLabel = (mi: number) => (mi === 0 ? "At your address" : `${mi} mi away`);
