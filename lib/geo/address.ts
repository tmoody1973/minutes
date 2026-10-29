export interface Address {
  houseNumber: number;
  houseNumberHigh?: number;
  dir: "N" | "S" | "E" | "W";
  street: string;
  type?: string;
}

const DIRS: Record<string, Address["dir"]> = { North: "N", South: "S", East: "E", West: "W" };

// Street types we map to MPROP codes.
const TYPES: Record<string, string> = {
  Avenue: "AV", Street: "ST", Place: "PL", Boulevard: "BL", Drive: "DR", Road: "RD",
  Court: "CT", Lane: "LA", Parkway: "PK", Way: "WY", Terrace: "TR",
};
// Real street types we don't map: stripped from the name, type omitted.
const OTHER_TYPES = ["Circle", "Highway", "Square", "Plaza", "Trail", "Pass", "Row", "Path", "Alley", "Walk"];
const ALL_TYPES = [...Object.keys(TYPES), ...OTHER_TYPES].join("|");

const NAME_TOKEN = String.raw`(?:\d+(?:st|nd|rd|th)|[A-Z][A-Za-z.'-]*|du|de|del|la|le|van|von|of)`;
// number[-high] [and number]* DIR name-tokens TYPE. Case-sensitive on purpose: capitalized names only
// (plus lowercase connectors like "du"). The direction word is REQUIRED: without it we cannot tell
// "2000 Fond du Lac Avenue" from a mis-parse, so we omit it (precision over recall).
// "...(that|which) (currently) includes N ..." names an existing context site, not a subject site: skipped.
// A number right after Phase/Unit/No./Number/Lot is not a house number.
const ADDRESS_RE = new RegExp(
  String.raw`(?<!\b(?:[Pp]hase|[Uu]nit|No\.?|[Nn]umber|[Ll]ot|includes)\s+)\b(\d{1,5})(?:-(\d{1,5}))?((?:\s+and\s+\d{1,5})*)\s+(North|South|East|West)\s+((?:${NAME_TOKEN}\s+){1,4}?)(${ALL_TYPES})\b`,
  "g",
);

function expandHigh(low: string, high: string): number | undefined {
  if (high.length >= low.length) return Number(high) > Number(low) ? Number(high) : undefined;
  // Short suffix ("1162-64"): keep low's leading digits; roll over by 10^len ("1199-02" -> 1202).
  const step = 10 ** high.length;
  let n = Number(low.slice(0, low.length - high.length) + high);
  while (n <= Number(low)) n += step;
  return n;
}

/** Street addresses (house number required) in a Legistar title, in order of appearance, de-duplicated. */
export function extractAddresses(title: string): Address[] {
  const out: Address[] = [];
  const seen = new Set<string>();
  for (const m of title.matchAll(ADDRESS_RE)) {
    const [, num, high, andList, dirWord, nameRaw, typeWord] = m;
    // MPROP spelling: uppercase, no periods/apostrophes, hyphens kept, single spaces.
    const street = nameRaw.toUpperCase().replace(/[.']/g, "").replace(/\s+/g, " ").trim();
    const type = TYPES[typeWord];
    const numbers = [Number(num), ...[...andList.matchAll(/\d+/g)].map((x) => Number(x[0]))];
    numbers.forEach((houseNumber, i) => {
      const a: Address = { houseNumber, dir: DIRS[dirWord], street };
      const hi = i === 0 && high ? expandHigh(num, high) : undefined;
      if (hi) a.houseNumberHigh = hi;
      if (type) a.type = type;
      const key = JSON.stringify(a);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(a);
      }
    });
  }
  return out;
}
