import type { Cue, Turn } from "@/lib/types";

// Precision over recall: any doubt -> no cue.

const LEAD_IN = /^(?:(?:good (?:afternoon|morning|evening)|hello|hi|yes|thank you|um|uh)(?:\s+(?:everyone|all))?[\s,.!]*)+/i;
const HONORIFIC = /\b(?:Commissioner|Alderman|Alderwoman|Alderperson|Ald\.?|Ms\.?|Mr\.?|Mrs\.?|Dr\.?)\s+/gi;
const HANDOFF =
  /^[\s,]*(?:the floor is yours|go ahead|would you like to|you(?:'|’)re recognized|you are recognized|please come forward|introduce yourselves?|for the record)/i;
const NOT_A_NAME = new Set(["the", "a", "an", "and", "for", "would", "you", "to", "of", "is", "on", "in", "i", "we", "at"]);
const AFFIL_STOP = new Set(["the", "a", "an", "and", "i", "we", "on", "for", "who", "that", "which", "to", "as", "here", "today", "at"]);
const WORD = /^[A-Za-z][A-Za-z'’-]*$/;
const CAP = /^[A-Z]/;

const clean = (w: string) => w.replace(/[^\p{L}\p{N}'’-]+$/u, "").replace(/^[^\p{L}\p{N}'’-]+/u, "");

function recognizedCue(turn: Turn): string | null {
  const text = turn.text;
  HONORIFIC.lastIndex = 0;
  for (let m = HONORIFIC.exec(text); m; m = HONORIFIC.exec(text)) {
    // attendance notes / escorts are not hand-offs
    if (/(?:joined|escorted|accompanied) by\s+$/i.test(text.slice(0, m.index))) continue;
    const rest = text.slice(m.index + m[0].length);
    const tokens = rest.split(/\s+/).filter(Boolean);
    for (const k of [1, 2]) {
      const words = tokens.slice(0, k);
      if (words.length < k) break;
      // internal punctuation (comma/period mid-name) means the name ended earlier
      if (words.slice(0, -1).some((w) => /[,.;?!]$/.test(w))) break;
      const names = words.map(clean);
      if (!names.every((w) => WORD.test(w) && !NOT_A_NAME.has(w.toLowerCase()))) break;
      // remainder after the name words
      const idx = words.reduce((pos, w) => rest.indexOf(w, pos) + w.length, 0);
      const after = rest.slice(idx);
      if (HANDOFF.test(after) || /^[\s.,?!]*$/.test(after)) return names.join(" ");
    }
  }
  return null;
}

type Parsed = { name: string; rest: string[]; stop: string };

// Reads 1-4 name words and requires a clean terminator; otherwise null.
function parseName(tokens: string[], needCap: boolean): Parsed | null {
  const words: string[] = [];
  for (let i = 0; i < tokens.length && words.length <= 4; i++) {
    const tok = tokens[i];
    const lower = tok.toLowerCase().replace(/[,.]+$/, "");
    const next = (tokens[i + 1] ?? "").toLowerCase();
    let stop = "";
    if (lower === "i'm" || lower === "i’m") stop = "i'm";
    else if (lower === "i" && (next === "am" || next === "live")) stop = `i ${next}`;
    else if (lower === "with" || lower === "from" || lower === "and") stop = lower;
    if (stop) return words.length ? { name: words.join(" "), rest: tokens.slice(i + 1), stop } : null;
    const w = clean(tok);
    if (!WORD.test(w) || (needCap && !CAP.test(w))) return null;
    words.push(w);
    if (/[,.]$/.test(tok)) return { name: words.join(" "), rest: tokens.slice(i + 1), stop: "punct" };
  }
  if (words.length && words.length <= 4 && tokens.length === words.length) return { name: words.join(" "), rest: [], stop: "end" };
  return null;
}

function affiliationOf(rest: string[]): string | undefined {
  const out: string[] = [];
  let i = 0;
  while (i < rest.length && /^(?:with|from)$/i.test(rest[i])) i++;
  for (; i < rest.length && out.length < 5; i++) {
    if (AFFIL_STOP.has(rest[i].toLowerCase().replace(/[,.]+$/, ""))) break;
    out.push(clean(rest[i]));
    if (/[,.]$/.test(rest[i])) break;
  }
  return out.length ? out.join(" ") : undefined;
}

function selfCue(turn: Turn): { name: string; affiliation?: string } | null {
  const s = turn.text.trim().replace(LEAD_IN, "").trim();
  const tokens = (str: string) => str.split(/\s+/).filter(Boolean);
  let m: RegExpMatchArray | null;

  if ((m = s.match(/^my name is\s+([\s\S]+)/i))) {
    const p = parseName(tokens(m[1]), false);
    if (!p) return null;
    const viaWithFrom = p.stop === "with" || p.stop === "from";
    const viaIm = p.stop === "i'm" && /^(?:with|from)$/i.test(p.rest[0] ?? "");
    return { name: p.name, affiliation: viaWithFrom || viaIm ? affiliationOf(p.rest) : undefined };
  }
  if ((m = s.match(/^this is\s+([\s\S]+)/i))) {
    const p = parseName(tokens(m[1]), true);
    if (!p || !["with", "from", "i live", "i'm"].includes(p.stop)) return null;
    return { name: p.name, affiliation: p.stop === "with" || p.stop === "from" ? affiliationOf(p.rest) : undefined };
  }
  if ((m = s.match(/^I(?:'|’)m\s+([\s\S]+)/i))) {
    const p = parseName(tokens(m[1]), true);
    if (!p || (p.stop !== "with" && p.stop !== "from")) return null;
    return { name: p.name, affiliation: affiliationOf(p.rest) };
  }
  if ((m = s.match(/^((?:[A-Z][\p{L}'’-]*\s+){1,3}[A-Z][\p{L}'’-]*),\s*([^.,]{0,40}?\bPlanning)\b/u))) {
    if (new RegExp(`^${HONORIFIC.source}`, "i").test(m[1] + " ")) return null;
    return { name: m[1], affiliation: m[2].trim() };
  }
  return null;
}

export function extractCues(turns: Turn[]): Cue[] {
  const cues: Cue[] = [];
  turns.forEach((turn, i) => {
    const self = selfCue(turn);
    if (self) cues.push({ kind: "self", ...self, turnKey: turn.turnKey, targetTurnKey: turn.turnKey });
    const name = recognizedCue(turn);
    if (name) {
      const target = turns.slice(i + 1).find((t) => t.label !== null && t.label !== turn.label);
      if (target) cues.push({ kind: "recognized", name, turnKey: turn.turnKey, targetTurnKey: target.turnKey });
    }
  });
  return cues;
}
