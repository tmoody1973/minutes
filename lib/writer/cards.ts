// The Clerk agent (brief §6.2): plain-language cards for files and meeting chapters, written from stored records only.
// Nothing it writes is shown until the Editor passes it sentence by sentence (lib/editor/check.ts).
import { sparkJSON } from "../meta/spark";
import type { Sentence } from "../editor/check";

type Draft = { sentences: { text: string; sources: string[] }[] };
export type Write = (system: string, user: string) => Promise<Draft>;

const COMMON = `You write for Milwaukee residents who have never read a city record. You are given public records, each with a key in brackets.
Write 1 to 3 short sentences in plain English, using only facts the records state. After each sentence, list the keys of the records it uses.
Rules: no opinions, no reasons or motives, no predictions, nothing the records do not say. Do not name individual officials or members; give vote counts.
Each sentence under 30 words; say it the way you would to a neighbor, not by copying the legal title.
Keep addresses, dates and numbers exactly as the records give them. Do not explain zoning terms.
Reply with JSON only: {"sentences": [{"text": "...", "sources": ["key", ...]}]}`;

const TASK = {
  file: `In 1 or 2 sentences: first what would be built or allowed (the kind of building or use), then the most recent decision (a vote, approval, adoption or signature; skip clerical steps such as drafting, publishing or assigning) and the next scheduled hearing if there is one, naming the body each time.
The page already shows the address, file number and aldermanic district, so do not repeat them, and do not name zoning districts.`,
  chapter: `In 1 or 2 sentences: what this agenda item would do (the kind of building, use or rule), then what the body did with it at this meeting and the vote count.
The page already shows the address and file number as the chapter title, so do not repeat them, and do not name zoning districts.`,
} as const;

export const isDraft = (x: unknown): x is Draft => {
  const s = (x as { sentences?: unknown } | null)?.sentences;
  return (
    Array.isArray(s) &&
    s.length >= 1 &&
    s.length <= 3 &&
    s.every(
      (e) =>
        typeof e?.text === "string" &&
        e.text.trim().length > 0 &&
        e.text.length <= 400 &&
        Array.isArray(e.sources) &&
        e.sources.every((k: unknown) => typeof k === "string"),
    )
  );
};

const sparkWrite: Write = (system, user) => sparkJSON(system, user, isDraft);

export async function writeCard(kind: keyof typeof TASK, sources: Record<string, string>, write: Write = sparkWrite): Promise<Sentence[]> {
  const records = Object.entries(sources).map(([k, text]) => `[${k}] ${text}`).join("\n");
  const draft = await write(`${COMMON}\n\n${TASK[kind]}`, `Records:\n${records}`);
  return draft.sentences.map((s) => ({ text: s.text.trim(), sourceKeys: s.sources }));
}
