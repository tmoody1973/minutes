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

const NAME_TOKEN = String.raw`(?:\d+(?:st|nd|rd|th)|[A-Z][A-Za-z.'-]*)`;
// number[-high] [and number]* DIR name-tokens TYPE. Case-sensitive on purpose: capitalized names only.
const ADDRESS_RE = new RegExp(
  String.raw`\b(\d{1,5})(?:-(\d{1,5}))?((?:\s+and\s+\d{1,5})*)\s+(North|South|East|West)\s+((?:${NAME_TOKEN}\s+){1,4}?)(${ALL_TYPES})\b`,
  "g",
);

function expandHigh(low: string, high: string): number | undefined {
  const full = high.length < low.length ? low.slice(0, low.length - high.length) + high : high;
  const n = Number(full);
  return n > Number(low) ? n : undefined;
}

/** Street addresses (house number required) in a Legistar title, in order of appearance, de-duplicated. */
export function extractAddresses(title: string): Address[] {
  const out: Address[] = [];
  const seen = new Set<string>();
  for (const m of title.matchAll(ADDRESS_RE)) {
    const [, num, high, andList, dirWord, nameRaw, typeWord] = m;
    const street = nameRaw.trim().toUpperCase();
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
