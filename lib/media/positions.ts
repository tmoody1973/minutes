// A speaker's "for"/"against" label may come ONLY from their own first-person
// words about the item itself. Anything doubtful returns null ("Position not stated").
// ponytail: regex heuristics, deliberately conservative; widen only with real transcript lines.

export type StatedPosition = { position: "for" | "against"; quote: string };

const NOUN =
  "proposal|project|development|rezoning|ordinance|item|file|moratorium|amendment|application|plan|change";
// "this"/"that" alone count only when they end the thought, so "support that the city..." is not a hit.
const ALONE = String.raw`(?=\s*$|\s*[,;]|\s+(?:and|but|because|so|too)\b)`;
const OBJ = String.raw`(?:it\b|this${ALONE}|that${ALONE}|(?:the|this)\s+(?:\w+\s+){0,3}?(?:${NOUN})s?\b(?!\s+(?:commission|team|staff|department|committee|board))|approv(?:ing|al)\s+(?:of|the|this|it|that)\b)`;
const OF_FOR = String.raw`(?:\s+(?:of|for))?`;
const FOR_WORD = String.raw`(?:in\s+(?:\w+\s+)?(?:support|favor)(?:\s+of)?|support(?:ing)?|(?:i'?m|we'?re|i am|we are)\s+for)`;
const AGAINST_WORD = String.raw`(?:in\s+(?:\w+\s+)?opposition(?:\s+to)?|opposed\s+to|oppos(?:e|ing)|against)`;
const ADV = String.raw`(?:(?:totally|just|strongly|absolutely|really|completely|fully|do|will|am|are)\s+)*`;

const PATTERNS: Array<[RegExp, "for" | "against"]> = [
  [new RegExp(`${FOR_WORD}${OF_FOR}\\s+${OBJ}`, "g"), "for"],
  [new RegExp(`${AGAINST_WORD}${OF_FOR}\\s+${OBJ}`, "g"), "against"],
  [new RegExp(`${FOR_WORD}${OF_FOR}\\s+a\\s+yes\\s+vote\\b`, "g"), "for"],
  [new RegExp(`${FOR_WORD}${OF_FOR}\\s+a\\s+no\\s+vote\\b`, "g"), "against"],
  [/\burge\b.*?\b(?:approve|vote\s+yes)\b/g, "for"],
  [/\burge\b.*?\b(?:deny|reject|vote\s+no)\b/g, "against"],
  // bare stance that ends the sentence: "I'm (just) (totally) against."
  [new RegExp(String.raw`\b(?:i|we)\s+${ADV}(?:support)\s*$`, "g"), "for"],
  [new RegExp(String.raw`\b(?:i|we)\s+${ADV}oppose\s*$`, "g"), "against"],
  [new RegExp(String.raw`\b(?:i'?m|we'?re|i am|we are)\s+${ADV}(?:for|in favor|in support)\s*$`, "g"), "for"],
  [new RegExp(String.raw`\b(?:i'?m|we'?re|i am|we are)\s+${ADV}(?:against|opposed)\s*$`, "g"), "against"],
];

const FIRST_PERSON = /\b(?:i|we|i'm|we're|i'd|we'd|i'll|we'll|my|our)\b/;
const OTHER_PERSON = /\b(?:you|you're|your|he|he's|she|she's|they|they're|them|their)\b/;
const NEGATED = /\b(?:not|never|don't|doesn't|won't|can't|cannot|hardly)\b(?:\s+[\w']+){0,3}\s*$/;

// Lowercase, straight apostrophes, collapse transcriber stutters ("to to" -> "to"). Matching only.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\w'\s]/g, " ")
    .replace(/\b([\w']+)(?:\s+\1\b)+/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\burge you\b/g, "urge"); // "we urge you to deny" is still first person
}

function sentencePositions(sentence: string): Set<"for" | "against"> {
  const found = new Set<"for" | "against">();
  const s = normalize(sentence);
  if (!FIRST_PERSON.test(s) || OTHER_PERSON.test(s)) return found;
  for (const [re, position] of PATTERNS) {
    for (const m of s.matchAll(re)) {
      if (!NEGATED.test(s.slice(0, m.index))) found.add(position);
    }
  }
  return found;
}

export function statedPosition(text: string): StatedPosition | null {
  let hit: StatedPosition | null = null;
  for (const raw of text.match(/[^.?!]+[.?!]*/g) ?? []) {
    const quote = raw.trim();
    if (!quote || quote.endsWith("?")) continue;
    const found = sentencePositions(quote);
    if (found.size > 1) return null;
    const [position] = found;
    if (!position) continue;
    if (hit && hit.position !== position) return null;
    hit ??= { position, quote };
  }
  return hit;
}
