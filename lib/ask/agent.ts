import { editorCheck, sparkVerify, type EditorVerdict, type Verify } from "../editor/check";
import { firstJSONObject, sparkChat, type ChatMessage, type ToolSpec } from "../meta/spark";
import { concernWords } from "../watcher/match";

// Ask Minutes (decision 008): Muse Spark looks things up with tools over Minutes' synced records, answers in a few
// cited sentences, and the Editor checks each sentence against only the records it cites. Nothing here is stored.
export type Rec = { key: string; label: string; text: string; href: string };
export type Tools = {
  find_files: (query: string) => Promise<Rec[]>;
  read_file: (fileNumber: string) => Promise<Rec[]>;
  find_moments: (query: string) => Promise<Rec[]>;
  find_in_documents: (query: string) => Promise<Rec[]>;
  upcoming: (days: number) => Promise<Rec[]>;
};
// follow: Muse's proposal for Follow this, words a later file on the same subject would have in its title. Shown for
// the person to edit before anything is saved.
export type Concern = { name: string; words: string[] };
export type Answer = { sentences: { text: string; sources: Rec[] }[]; rejected: number; records: Rec[]; follow?: Concern };
type Chat = (messages: ChatMessage[], tools?: ToolSpec[]) => Promise<ChatMessage & { role: "assistant" }>;
type Opts = { chat?: Chat; verify?: Verify; onStep?: (text: string) => void; maxRounds?: number; onRejected?: (text: string, why: string) => void };

const MAX_ROUNDS = 4;
const MAX_CALLS = 6;
const MAX_RECORDS_SHOWN = 8;
// What the model reads of each record. A document passage (600 characters plus its source line) fits whole.
const RECORD_CHARS_SHOWN = 700;

const SYSTEM = `You are Ask Minutes. You answer questions about Milwaukee City Hall (the Common Council, its committees, and the City Plan, Fire & Police and Historic Preservation commissions) using only the records your tools return.
Look first. find_files finds files by subject words or file number. read_file gives a file's full record: its steps, votes and upcoming agenda dates. find_moments finds words said in meetings. find_in_documents finds words inside the documents attached to files (staff reports, fiscal notes, contracts): use it for what a file would do, cost or require. upcoming lists agenda items for the next days.
Search with short subject words (two to four), and try a few phrasings at once. Read the most relevant files before answering.
When the question is about a time ("this week", "this month", "coming up", "next"), also call upcoming, and read the newest matching files.
Rules for the answer:
- Say only what the records state. No reasons, judgments, predictions, advice or opinions, and never whether something is good or bad.
- Give vote counts, never how a named member voted.
- Keep names, dates, numbers and file numbers exactly as the records give them. Describe actions in everyday words only when they mean exactly the same thing ("sent on without a recommendation" for "Referred without recommendation"; the records don't say where to); otherwise use the record's own action words in lowercase ("placed on file", "held to call of the chair"). Never write in capital letters.
- Don't add what a record doesn't say: who sent or wrote something, that something was a "report", "review" or "follow-up", or that anything was finished.
- Two to five short sentences, each under 30 words, one or two facts each. Write for a resident who has never read a city record.
- The first sentence sums up what the records show: how many files are about this, what they are about, and where they stand now.
- Name a file by what it is, in everyday words from its title ("a police department communication about license plate reader cameras"), never by its number: the file number is shown next to the sentence already. Never start a sentence with "File".
- List each sentence's record keys (the text in square brackets) in its "sources", never in its text.
- If the records don't answer the question, return no sentences.
Also propose how to follow this: "name", two to five words naming the subject (never a street address), and "words", two to four short words or phrases found in the titles of the files you read that a new file on the same subject would also have in its title. Pick words specific to the subject ("license plate reader", "tavern"), never department or committee names or general words ("police department", "recommendations", "communication").
When you are done looking, reply with JSON only: {"sentences":[{"text":"...","sources":["matter:123","history:456"]}],"follow":{"name":"...","words":["...","..."]}}`;

const str = { type: "string" } as const;
const TOOL_SPECS: ToolSpec[] = [
  { type: "function", function: { name: "find_files", description: "Find City Hall files by subject words or a file number.", parameters: { type: "object", properties: { query: str }, required: ["query"] } } },
  { type: "function", function: { name: "read_file", description: "Every record of one file: steps through committees and Council, votes, upcoming agenda dates.", parameters: { type: "object", properties: { file_number: str }, required: ["file_number"] } } },
  { type: "function", function: { name: "find_moments", description: "Find words said in recorded meetings.", parameters: { type: "object", properties: { query: str }, required: ["query"] } } },
  { type: "function", function: { name: "find_in_documents", description: "Find words inside files' attached documents: staff reports, fiscal notes, contracts.", parameters: { type: "object", properties: { query: str }, required: ["query"] } } },
  { type: "function", function: { name: "upcoming", description: "Agenda items for meetings in the next days (1 to 14).", parameters: { type: "object", properties: { days: { type: "number" } }, required: ["days"] } } },
];

// The plain-words step a person sees while the agent works.
function stepText(name: string, a: Record<string, unknown>): string {
  if (name === "find_files") return `Searching files for "${String(a.query ?? "")}"`;
  if (name === "read_file") return `Reading file ${String(a.file_number ?? "")}`;
  if (name === "find_moments") return `Searching what was said in meetings for "${String(a.query ?? "")}"`;
  if (name === "find_in_documents") return `Searching the files' documents for "${String(a.query ?? "")}"`;
  return `Checking agendas for the next ${Number(a.days) || 7} days`;
}

async function runTool(tools: Tools, name: string, a: Record<string, unknown>): Promise<Rec[]> {
  if (name === "find_files") return tools.find_files(String(a.query ?? ""));
  if (name === "read_file") return tools.read_file(String(a.file_number ?? ""));
  if (name === "find_moments") return tools.find_moments(String(a.query ?? ""));
  if (name === "find_in_documents") return tools.find_in_documents(String(a.query ?? ""));
  if (name === "upcoming") return tools.upcoming(Number(a.days) || 7);
  return [];
}

const parseArgs = (raw: string): Record<string, unknown> => {
  try {
    const x = JSON.parse(raw);
    return typeof x === "object" && x !== null ? x : {};
  } catch {
    return {};
  }
};

type Draft = { text: string; sources: string[] };
function concernOf(x: unknown): Concern | undefined {
  const f = (x as { follow?: { name?: unknown; words?: unknown } })?.follow;
  const words = Array.isArray(f?.words) ? concernWords(f.words) : [];
  if (!words.length) return undefined;
  const name = typeof f?.name === "string" && f.name.trim() ? f.name.replace(/\s+/g, " ").trim().slice(0, 60) : words.join(", ").slice(0, 60);
  return { name, words };
}
// Keys belong in sources; strip any the model also wrote into the sentence.
const clean = (d: Draft): Draft => ({ ...d, text: d.text.replace(/\s*\[[a-z]+:[^\]\s]+\]/g, "").trim() });
const isDraft = (x: unknown): x is { sentences: Draft[] } =>
  typeof x === "object" && x !== null && Array.isArray((x as { sentences?: unknown }).sentences) &&
  (x as { sentences: unknown[] }).sentences.every((s) => typeof (s as Draft)?.text === "string" && Array.isArray((s as Draft).sources));

export async function runAgent(question: string, tools: Tools, opts: Opts = {}): Promise<Answer> {
  const chat = opts.chat ?? sparkChat;
  const verify = opts.verify ?? sparkVerify;
  const onStep = opts.onStep ?? (() => {});
  const found = new Map<string, Rec>();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: question.trim().slice(0, 500) },
  ];

  let draft: { sentences: Draft[] } | null = null;
  let follow: Concern | undefined;
  for (let round = 0; round < (opts.maxRounds ?? MAX_ROUNDS) && !draft; round++) {
    const reply = await chat(messages, TOOL_SPECS);
    messages.push(reply);
    if (!reply.tool_calls?.length) {
      const parsed = firstJSONObject(reply.content ?? "");
      if (isDraft(parsed)) draft = parsed;
      follow = concernOf(parsed);
      break;
    }
    // One round's lookups run together; steps and tool replies keep the model's order.
    const calls = reply.tool_calls.slice(0, MAX_CALLS).map((call) => ({ call, args: parseArgs(call.function.arguments) }));
    calls.forEach(({ call, args }) => onStep(stepText(call.function.name, args)));
    const results = await Promise.all(calls.map(({ call, args }) => runTool(tools, call.function.name, args)));
    calls.forEach(({ call }, i) => {
      for (const r of results[i]) found.set(r.key, r);
      const content = results[i].length ? results[i].map((r) => `[${r.key}] ${r.text.slice(0, RECORD_CHARS_SHOWN)}`).join("\n") : "No records found.";
      messages.push({ role: "tool", tool_call_id: call.id, content });
    });
    // Calls past the cap still need an answer, or the model's next turn is rejected.
    for (const call of reply.tool_calls.slice(MAX_CALLS)) messages.push({ role: "tool", tool_call_id: call.id, content: "Skipped: too many lookups at once." });
  }
  if (!draft) {
    // Out of rounds or prose instead of JSON: one last turn with no tools.
    messages.push({ role: "user", content: 'Reply now with the JSON only: {"sentences":[...]}' });
    const parsed = firstJSONObject((await chat(messages)).content ?? "");
    draft = isDraft(parsed) ? parsed : { sentences: [] };
    follow = concernOf(parsed);
  }

  const drafts = draft.sentences.slice(0, 5).map(clean);
  if (drafts.length) onStep(`Checking ${drafts.length} ${drafts.length === 1 ? "sentence" : "sentences"} against the records`);
  const texts = new Map([...found].map(([k, r]) => [k, r.text]));
  const check = (ds: Draft[]) => Promise.all(ds.map((d) => editorCheck({ text: d.text, sourceKeys: d.sources }, texts, verify)));
  const verdicts = await check(drafts);
  // Rejected sentences never leave this function except to a debugging callback (the terminal script).
  const report = (ds: Draft[], vs: EditorVerdict[]) => ds.forEach((d, i) => !vs[i].ok && opts.onRejected?.(d.text, `${vs[i].reason}: ${vs[i].detail}`));
  report(drafts, verdicts);

  // One rewrite pass: sentences the Editor sent back for wording (not for citing nothing) go back to the writer once,
  // with the Editor's reason, and are checked again. A rewrite that fails again is dropped.
  const final: (Draft | null)[] = drafts.map((d, i) => (verdicts[i].ok ? d : null));
  const back = drafts.flatMap((d, i) => {
    const v = verdicts[i];
    return !v.ok && (v.reason === "unsupported" || v.reason === "evaluative") ? [{ i, d, why: v.detail }] : [];
  });
  if (back.length) {
    onStep(`Rewriting ${back.length} ${back.length === 1 ? "sentence" : "sentences"} the Editor sent back`);
    messages.push({
      role: "user",
      content: `The Editor sent these sentences back:\n${back.map((b) => `- "${b.d.text}" Reason: ${b.why}`).join("\n")}\nRewrite each so its cited records state everything it says, using the records' own words where needed, or leave it out. Reply with JSON only: {"sentences":[...]}, the rewrites in the same order.`,
    });
    const parsed = firstJSONObject((await chat(messages)).content ?? "");
    const rewrites = isDraft(parsed) ? parsed.sentences.slice(0, back.length).map(clean) : [];
    const again = await check(rewrites);
    report(rewrites, again);
    rewrites.forEach((r, j) => {
      if (again[j].ok) final[back[j].i] = r;
    });
  }
  const kept = final.filter((d): d is Draft => d !== null);
  const sentences = kept.map((d) => ({ text: d.text, sources: d.sources.map((k) => found.get(k)!) }));

  // The records behind the answer: one row per page, cited pages first, each shown by its file record when one was read.
  const cited = sentences.flatMap((s) => s.sources);
  const fileRec = new Map([...found.values()].filter((r) => r.key.startsWith("matter:")).map((r) => [r.href, r]));
  const byHref = new Map<string, Rec>();
  for (const r of [...cited, ...found.values()]) if (!byHref.has(r.href)) byHref.set(r.href, fileRec.get(r.href) ?? r);
  return { sentences, rejected: drafts.length - sentences.length, records: [...byHref.values()].slice(0, MAX_RECORDS_SHOWN), ...(follow && { follow }) };
}
