// Review helpers for scripts/speakers.ts. Suggestions only: nothing here renames a speaker (Ruling 25).

export interface ChapterRef { eventItemId: number; startMs: number | null; endMs: number | null; located: string; fileNumber?: string; title?: string }
export interface LabelChapter { eventItemId: number; fileNumber?: string; title?: string; turnCount: number }

// Located chapters a label's turns start in, in chapter order. The caller joins fileNumber/title onto chapters.
export function labelChapters(turns: { label: string | null; startMs: number }[], chapters: ChapterRef[], label: string): LabelChapter[] {
  const mine = turns.filter((t) => t.label === label);
  const out: LabelChapter[] = [];
  for (const c of chapters) {
    if (c.located === "not-located" || c.startMs === null || c.endMs === null) continue;
    const turnCount = mine.filter((t) => t.startMs >= c.startMs! && t.startMs < c.endMs!).length;
    if (turnCount) out.push({ eventItemId: c.eventItemId, ...(c.fileNumber ? { fileNumber: c.fileNumber } : {}), ...(c.title ? { title: c.title } : {}), turnCount });
  }
  return out;
}

export const granicusLink = (clipId: number, startMs: number): string =>
  `https://milwaukee.granicus.com/MediaPlayer.php?clip_id=${clipId}&starttime=${Math.floor(startMs / 1000)}`;

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const HONORIFICS = new Set(["mr", "mrs", "ms", "dr", "alderman", "alderwoman", "commissioner", "chair", "director", "attorney"]);

// Capitalized names in the minutes whose surname is within edit distance 2 of the heard surname. A name needs its first
// word's initial to match the heard first name's; a lone surname (after an honorific or punctuation) is a surname-only hint.
// ponytail: runs of up to 3 capitalized words; no middle-name or suffix handling. Upgrade if real minutes need it.
export function spellingHints(heardName: string, minutesText: string): string[] {
  const heard = heardName.trim().split(/\s+/);
  const surname = heard[heard.length - 1].toLowerCase();
  const initial = heard.length > 1 ? heard[0][0].toLowerCase() : undefined;
  const hints: string[] = [];
  let run: string[] = [];
  for (const tok of minutesText.split(/\s+/)) {
    const word = tok.replace(/[.,:;()]+$/, "").replace(/^[("]+/, "");
    const capitalized = /^[A-Z][A-Za-z'’-]+$/.test(word) && !HONORIFICS.has(word.toLowerCase());
    if (!capitalized) { run = []; continue; }
    run = [...run, word].slice(-3);
    if (editDistance(word.toLowerCase(), surname) <= 2) {
      const names = run.length === 1 ? [word] : [3, 2].filter((n) => run.length >= n && (!initial || run[run.length - n][0].toLowerCase() === initial)).map((n) => run.slice(-n).join(" "));
      const hint = run.length === 1 || names.length ? names[0] : undefined;
      if (hint && hint.toLowerCase() !== heardName.trim().toLowerCase() && !hints.includes(hint)) hints.push(hint);
    }
    if (tok !== word) run = []; // trailing punctuation ends the run
  }
  return hints;
}

// A name a speaker gave themselves ("my name is Brian Emmerich"), looser than the ingest cue so more labels get hints.
// Only feeds spelling suggestions; never assigns anything.
export function selfIntroName(text: string): string | undefined {
  return text.match(/\b(?:[Mm]y name is|[Tt]his is|I'm|I am)\s+([A-Z][\p{L}'’-]+\s+[A-Z][\p{L}'’-]+)/u)?.[1];
}
