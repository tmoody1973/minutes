// Search helpers, pure. Legistar titles spell addresses out ("711 East Kilbourn Avenue"); residents type
// "711 E Kilbourn Ave", so the query is expanded before it reaches the title index.
const ABBREV: Record<string, string> = {
  n: "North", s: "South", e: "East", w: "West",
  ave: "Avenue", av: "Avenue", st: "Street", blvd: "Boulevard", rd: "Road", dr: "Drive",
  pl: "Place", ct: "Court", pkwy: "Parkway", ln: "Lane", ter: "Terrace", hwy: "Highway",
};

export function expandAddress(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .map((w) => ABBREV[w.replace(/\.$/, "").toLowerCase()] ?? w)
    .join(" ");
}

// The title index matches whole words only ("license" never finds "licenses"), so each word also brings its other
// form. ponytail: plain s-plural rule; irregular plurals ("policies") still need the agent's own rephrasing.
const MAX_TERMS = 16; // Convex search allows at most 16 terms.
export function withWordForms(q: string): string {
  const other = (w: string) => (!/^[a-z]{4,}$/i.test(w) || /ss$/i.test(w) ? null : /s$/i.test(w) ? w.slice(0, -1) : `${w}s`);
  const words = q.trim().split(/\s+/);
  return words.flatMap((w) => [w, other(w)].filter((x): x is string => !!x && (x === w || !words.includes(x)))).slice(0, MAX_TERMS).join(" ");
}

const WINDOW = 220;

/** About WINDOW characters of `text` around the first query word found, with "…" where it was cut. */
export function snippet(text: string, q: string): string {
  if (text.length <= WINDOW) return text;
  const lower = text.toLowerCase();
  const hits = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1).map((w) => lower.indexOf(w)).filter((i) => i >= 0);
  const at = hits.length ? Math.min(...hits) : 0;
  const start = Math.max(0, Math.min(at - WINDOW / 3, text.length - WINDOW));
  const end = Math.min(text.length, start + WINDOW);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
