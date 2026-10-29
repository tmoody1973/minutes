// Lightly cleaned quotes: the only edits are removing immediately repeated
// words and applying exact Legistar corrections. Nothing else may change.

const LEAD_PUNCT = /^[.,?!;:"'()]+/;
const TRAIL_PUNCT = /[.,?!;:"'()]+$/;

type Parts = { lead: string; core: string; trail: string };

function splitToken(token: string): Parts {
  const lead = token.match(LEAD_PUNCT)?.[0] ?? "";
  const rest = token.slice(lead.length);
  const trail = rest.match(TRAIL_PUNCT)?.[0] ?? "";
  return { lead, core: rest.slice(0, rest.length - trail.length), trail };
}

// Comparison key for a word, or null for punctuation-only tokens ("-", "--").
function wordKey(token: string): string | null {
  const { core } = splitToken(token);
  return /[\p{L}\p{N}]/u.test(core) ? core.toLowerCase() : null;
}

// One run of same-word tokens becomes its first token; the last token's
// trailing punctuation is kept when the first token has none.
function mergeRun(run: readonly string[]): string {
  const first = run[0];
  const lastTrail = splitToken(run[run.length - 1]).trail;
  return splitToken(first).trail === "" && lastTrail !== "" ? first + lastTrail : first;
}

function collapseRepeats(tokens: readonly string[]): { kept: string[]; changed: boolean } {
  const kept: string[] = [];
  let changed = false;
  let i = 0;
  while (i < tokens.length) {
    const key = wordKey(tokens[i]);
    let j = i + 1;
    if (key !== null) {
      while (j < tokens.length && wordKey(tokens[j]) === key) j++;
    }
    const run = tokens.slice(i, j);
    if (run.length > 1) changed = true;
    kept.push(run.length > 1 ? mergeRun(run) : run[0]);
    i = j;
  }
  return { kept, changed };
}

function correctToken(token: string, corrections: ReadonlyMap<string, string>): string {
  const whole = corrections.get(token);
  if (whole !== undefined) return whole;
  const { lead, core, trail } = splitToken(token);
  if (core === "") return token;
  const fixed = corrections.get(core);
  return fixed === undefined ? token : lead + fixed + trail;
}

export function cleanQuote(text: string, corrections: ReadonlyMap<string, string>): string {
  const tokens = text.split(/\s+/).filter((t) => t !== "");
  const { kept, changed } = collapseRepeats(tokens);
  const corrected = kept.map((t) => correctToken(t, corrections));
  const correctedAny = corrected.some((t, i) => t !== kept[i]);
  if (!changed && !correctedAny) return text;
  return corrected.join(" ");
}
