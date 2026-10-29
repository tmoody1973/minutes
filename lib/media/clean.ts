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

// A run collapses only when no punctuation would be lost: leading marks may
// sit on the first token alone, trailing marks on the last token alone.
// "No. no" and "(the) the plan" stay as heard; "so so. the" collapses to "so.".
function canCollapse(run: readonly Token[]): boolean {
  const parts = run.map((t) => splitToken(t.text));
  return parts.slice(1).every((p) => p.lead === "") && parts.slice(0, -1).every((p) => p.trail === "");
}

// Keeps the first token's leading punctuation and casing, and the last
// token's trailing punctuation: "the the," -> "the,", "(the the" -> "(the".
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
// spaces survive. A collapsed run is replaced by one token; any other run is
// emitted token by token as heard, with the original separators kept.
export function cleanQuote(text: string, corrections: ReadonlyMap<string, string>): string {
  let out = "";
  let cursor = 0;
  for (const run of groupRuns(tokenize(text))) {
    if (run.length > 1 && canCollapse(run)) {
      out += text.slice(cursor, run[0].start) + correctToken(mergeRun(run), corrections);
      cursor = run[run.length - 1].end;
      continue;
    }
    for (const token of run) {
      out += text.slice(cursor, token.start) + correctToken(token.text, corrections);
      cursor = token.end;
    }
  }
  return out + text.slice(cursor);
}
