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
// A whole match is skipped (all numbers in its "and" list) when it follows "includes" (an existing
// context site, not a subject site) or Phase/Unit/No./Number/Lot (not a house number).
const SKIP_BEFORE = /\b(?:phase|unit|no\.?|number|lot|includes)\s+$/i;
const ADDRESS_RE = new RegExp(
  String.raw`\b(\d{1,5})(?:-(\d{1,5}))?((?:\s+and\s+\d{1,5})*)\s+(North|South|East|West)\s+((?:${NAME_TOKEN}\s+){1,4}?)(${ALL_TYPES})\b`,
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
    if (SKIP_BEFORE.test(title.slice(0, m.index))) continue;
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

// Street types as residents type them (full word or common abbreviation) -> MPROP code.
const TYPED_TYPES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TYPES).map(([word, code]) => [word.toUpperCase(), code])),
  AVE: "AV", AV: "AV", ST: "ST", PL: "PL", BLVD: "BL", BL: "BL", DR: "DR", RD: "RD", CT: "CT", LN: "LA", LA: "LA",
  PKWY: "PK", PK: "PK", WY: "WY", TER: "TR", TR: "TR",
};
const TYPED_RE = /^(\d{1,5})\s+(N|S|E|W|NORTH|SOUTH|EAST|WEST)\s+(.+)$/;

/**
 * A resident's typed address ("711 E Kilbourn Ave", "711 East Kilbourn Avenue, Milwaukee, WI 53202") -> Address,
 * or null when it is not a numbered street address with a direction (the caller then uses another geocoder).
 * Only a trailing "Milwaukee [WI]" or ZIP is dropped without a comma: "1 W Wisconsin" is a street, not the state.
 */
export function parseTypedAddress(text: string): Address | null {
  const line = text.split(",")[0].toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim()
    .replace(/(?:\s+MILWAUKEE(?:\s+(?:WI|WISCONSIN))?)?(?:\s+\d{5}(?:-\d{4})?)?$/, "")
    .trim();
  const m = TYPED_RE.exec(line);
  if (!m) return null;
  const words = m[3].split(" ");
  const type = TYPED_TYPES[words[words.length - 1]];
  const street = (type ? words.slice(0, -1) : words).join(" ");
  if (!street || !/^[A-Z0-9 -]{1,40}$/.test(street)) return null;
  return { houseNumber: Number(m[1]), dir: m[2][0] as Address["dir"], street, ...(type && { type }) };
}
