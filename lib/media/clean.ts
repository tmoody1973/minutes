// Lightly cleaned quotes: the only edits are removing immediately repeated
// words and applying exact Legistar corrections. Nothing else may change.

const LEAD_PUNCT = /^[.,?!;:"'()]+/;
const TRAIL_PUNCT = /[.,?!;:"'()]+$/;

type Parts = { lead: string; core: string; trail: string };
type Token = { text: string; start: number; end: number };

function splitToken(token: string): Parts {
  const lead = token.match(LEAD_PUNCT)?.[0] ?? "";
  const rest = token.slice(lead.length);
  const trail = rest.match(TRAIL_PUNCT)?.[0] ?? "";
  return { lead, core: rest.slice(0, rest.length - trail.length), trail };
}

// Only words with a letter in the core can collapse. Punctuation-only tokens
// ("-") and numbers ("3", "1.") stay as heard.
function wordKey(token: string): string | null {
  const { core } = splitToken(token);
  return /\p{L}/u.test(core) ? core.toLowerCase() : null;
}

// Keeps the first token's leading punctuation and casing, and the last
// token's trailing punctuation: "no, no?" -> "no?", "the the," -> "the,".
function mergeRun(run: readonly Token[]): string {
  const { lead, core } = splitToken(run[0].text);
  const { trail } = splitToken(run[run.length - 1].text);
  return lead + core + trail;
}

function tokenize(text: string): Token[] {
  return [...text.matchAll(/\S+/g)].map((m) => ({
    text: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
}

function groupRuns(tokens: readonly Token[]): Token[][] {
  const runs: Token[][] = [];
  for (const token of tokens) {
    const run = runs[runs.length - 1];
    const key = wordKey(token.text);
    if (run && key !== null && wordKey(run[run.length - 1].text) === key) {
      run.push(token);
    } else {
      runs.push([token]);
    }
  }
  return runs;
}

function correctToken(token: string, corrections: ReadonlyMap<string, string>): string {
  const whole = corrections.get(token);
  if (whole !== undefined) return whole;
  const { lead, core, trail } = splitToken(token);
  if (core === "") return token;
  const fixed = corrections.get(core);
  return fixed === undefined ? token : lead + fixed + trail;
}

// Text outside an edit is copied byte-for-byte, so line breaks and double
// spaces survive. Only a collapsed run is replaced, with the original
// separator before it kept.
export function cleanQuote(text: string, corrections: ReadonlyMap<string, string>): string {
  let out = "";
  let cursor = 0;
  for (const run of groupRuns(tokenize(text))) {
    const first = run[0];
    const last = run[run.length - 1];
    const word = run.length > 1 ? mergeRun(run) : first.text;
    out += text.slice(cursor, first.start) + correctToken(word, corrections);
    cursor = last.end;
  }
  return out + text.slice(cursor);
}
