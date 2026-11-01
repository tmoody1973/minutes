import { sparkJSON } from "../meta/spark";
import { evaluativeWord } from "./rules";

export type Sentence = { text: string; sourceKeys: string[] };
export type EditorVerdict = { ok: true } | { ok: false; reason: "no-source" | "unknown-source" | "evaluative" | "unsupported"; detail: string };
export type Verify = (text: string, sources: string[]) => Promise<{ supported: boolean; reason: string }>;

const SYSTEM = `You check one sentence against public records. You are given the sentence and the records it cites, nothing else.
Answer "supported": true only if the records state everything the sentence says: every name, number, date, place and outcome.
A sentence that adds a reason, a judgment, a prediction or anything the records do not say is not supported.
Reply with JSON only: {"supported": true or false, "reason": "<one short sentence>"}`;

const isVerdict = (x: unknown): x is { supported: boolean; reason: string } =>
  typeof x === "object" && x !== null && typeof (x as { supported?: unknown }).supported === "boolean" && typeof (x as { reason?: unknown }).reason === "string";

// The Editor never sees the drafting prompt or the other sentences: only this sentence and its own sources.
export const sparkVerify: Verify = (text, sources) =>
  sparkJSON(SYSTEM, `Sentence:\n${text}\n\nRecords:\n${sources.map((s, i) => `[${i + 1}] ${s}`).join("\n")}`, isVerdict);

/** Cite-or-reject: no source, unknown source, evaluative wording, then the model's support check, in that order. */
export async function editorCheck(sentence: Sentence, sources: Map<string, string>, verify: Verify = sparkVerify): Promise<EditorVerdict> {
  if (!sentence.sourceKeys.length) return { ok: false, reason: "no-source", detail: "The sentence cites no record." };
  const missing = sentence.sourceKeys.find((k) => !sources.has(k));
  if (missing !== undefined) return { ok: false, reason: "unknown-source", detail: missing };
  const word = evaluativeWord(sentence.text);
  if (word) return { ok: false, reason: "evaluative", detail: word };
  const v = await verify(sentence.text, sentence.sourceKeys.map((k) => sources.get(k)!));
  return v.supported ? { ok: true } : { ok: false, reason: "unsupported", detail: v.reason };
}
