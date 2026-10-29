// Usage: npx tsx scripts/ingest-meeting.ts <eventId> [--reconfirm | --reparts]
//   --reconfirm  re-ask Muse Spark for speaker confirmations AND chapter parts
//   --captions   allow captions to replace stored transcript turns when data/transcripts/<id> is missing
//   --reparts    refresh chapter parts only; stored speaker confirmations are still reused
// NOTE: turns, speaker assignments and chapters are written by SEPARATE mutations (not one transaction).
// A run that fails midway can leave an event mixed (e.g. new turns with old assignments or chapters).
// Re-running the script heals it: every step is idempotent per event, and stored model decisions are reused.
// Stitches a local transcript (or fetches city captions), names speakers, aligns chapters, and writes
// validated results to DEV Convex via internal functions. Re-runs reuse stored model decisions (Rulings 17, 22).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { alignChapters, proposeParts } from "../lib/media/chapters";
import { extractCues } from "../lib/media/cues";
import { assertCaptionsAllowed, batchBySize, candidateKey, chunkFiles, namesFingerprint, outageRow, partsDecision, partsNames, reuseOrCall } from "../lib/media/ingest";
import { assignFromCues, confirmAssignments, nameSpeakers, validateAssignment, type RosterEntry } from "../lib/media/speakers";
import { stitchChunks } from "../lib/media/stitch";
import { parseVtt } from "../lib/media/vtt";
import { sparkJSON } from "../lib/meta/spark";
import type { ChapterPart, EventItemRecord, SpeakerAssignment, Turn } from "../lib/types";
import { convexRun } from "./convex-run";

const MODEL = "muse-spark-1.3";
const BATCH_BYTES = 150_000;
const UA = "Minutes/0.1 (tarik@radiomilwaukee.org)";

type StoredChapter = { namesFingerprint?: string; eventItemId: number; startMs?: number; endMs?: number; located: string; parts: ChapterPart[]; partsSource?: "model" | "none"; partsReason?: string };

let sparkCalls = 0;
let sparkErrors = 0;
const counted = (async (...a: Parameters<typeof sparkJSON>) => {
  sparkCalls++;
  try {
    return await sparkJSON(...a);
  } catch (e) {
    sparkErrors++;
    throw e;
  }
}) as typeof sparkJSON;

async function loadTurns(eventId: number, clipId: number | null, allowCaptions: boolean): Promise<{ turns: Turn[]; source: "transcript" | "captions" }> {
  const dir = `data/transcripts/${eventId}`;
  if (existsSync(dir)) {
    const chunks = chunkFiles(readdirSync(dir), dir).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
    return { turns: stitchChunks(eventId, chunks), source: "transcript" };
  }
  assertCaptionsAllowed(eventId, convexRun<"transcript" | "captions" | "none">("media:sourceForEvent", { eventId }), allowCaptions);
  if (clipId === null) throw new Error(`event ${eventId}: no local transcript and no clipId for captions`);
  const url = `https://milwaukee.granicus.com/videos/${clipId}/captions.vtt`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status !== 200) throw new Error(`captions fetch ${url} returned HTTP ${res.status}; nothing ingested for event ${eventId}`);
  return { turns: parseVtt(await res.text(), eventId), source: "captions" };
}

const turnRow = (t: Turn, source: "transcript" | "captions") => ({ turnKey: t.turnKey, chunk: t.chunk, startMs: t.startMs, endMs: t.endMs, ...(t.label ? { label: t.label } : {}), text: t.text, source });

async function writeTurns(eventId: number, turns: Turn[], source: "transcript" | "captions") {
  for (const turns_ of batchBySize(turns.map((t) => turnRow(t, source)), BATCH_BYTES)) convexRun("media:upsertTurns", { eventId, turns: turns_ });
  const keep = new Set(turns.map((t) => t.turnKey));
  const stale = convexRun<string[]>("media:turnKeysForEvent", { eventId }).filter((k) => !keep.has(k));
  for (const b of batchBySize(stale, BATCH_BYTES, 1000)) convexRun("media:removeTurns", { eventId, turnKeys: b });
  return stale.length;
}

async function nameStep(eventId: number, bodyId: number, turns: Turn[], reconfirm: boolean) {
  const cues = extractCues(turns);
  const roster = convexRun<RosterEntry[]>("legistar:rosterForBody", { bodyId });
  const candidates = assignFromCues(turns, cues, roster);
  const stored = new Map(convexRun<{ candidateKey: string; confirm: boolean; reason: string }[]>("media:confirmationsForEvent", { eventId }).map((c) => [c.candidateKey, c]));
  const accepted: SpeakerAssignment[] = [];
  const fresh: { candidateKey: string; confirm: boolean; reason: string; model: string; at: number }[] = [];
  let reused = 0;
  for (const a of candidates) {
    const key = candidateKey(a);
    if (reuseOrCall(key, stored, reconfirm) === "reuse") {
      reused++;
      if (stored.get(key)!.confirm) accepted.push(a);
      continue;
    }
    const errsBefore = sparkErrors;
    const r = await confirmAssignments([a], turns, cues, counted);
    if (sparkErrors > errsBefore || r.rejected.some((x) => x.reason === "context not found")) continue; // failures are not decisions; never stored
    if (r.accepted.length) accepted.push(a);
    fresh.push({ candidateKey: key, confirm: r.accepted.length > 0, reason: r.accepted.length ? "confirmed" : r.rejected[0].reason, model: MODEL, at: Date.now() });
  }
  if (fresh.length) convexRun("media:recordConfirmations", { eventId, rows: fresh });
  const validated = accepted.filter((a) => validateAssignment(a, turns, cues, roster));
  convexRun("media:replaceAssignments", { eventId, assignments: validated.map(({ at: _a, by: _b, ...a }) => a) });
  return { validated, reused, newConf: fresh.length };
}

async function chapterStep(eventId: number, turns: Turn[], assignments: SpeakerAssignment[], withParts: boolean, reconfirm: boolean, reparts: boolean) {
  const items = convexRun<EventItemRecord[]>("media:itemsForEvent", { eventId });
  const meetingEnd = Math.max(0, ...turns.map((t) => t.endMs));
  const aligned = alignChapters(items, turns, meetingEnd);
  const prior = new Map(convexRun<StoredChapter[]>("media:chaptersForEvent", { eventId }).map((c) => [c.eventItemId, c]));
  const overrides = convexRun<{ label: string; name: string; hidden?: boolean; at: number }[]>("media:overridesForEvent", { eventId });
  const { forParts, fingerprint } = partsNames(assignments, overrides);
  const rows: StoredChapter[] = [];
  for (const c of aligned) {
    const base: StoredChapter = { eventItemId: c.eventItemId, located: c.located, parts: [], ...(c.startMs !== null ? { startMs: c.startMs } : {}), ...(c.endMs !== null ? { endMs: c.endMs } : {}) };
    if (!withParts || c.startMs === null) {
      rows.push(base);
      continue;
    }
    const old = prior.get(c.eventItemId);
    if (partsDecision({ old, window: { startMs: c.startMs, endMs: c.endMs! }, fingerprint, reconfirm, reparts }) === "reuse") {
      rows.push({ ...base, parts: old!.parts, partsSource: old!.partsSource, namesFingerprint: fingerprint, ...(old!.partsReason ? { partsReason: old!.partsReason } : {}) });
      continue;
    }
    const errsBefore = sparkErrors;
    const parts = await proposeParts(c, turns, forParts, counted);
    if (sparkErrors > errsBefore && parts.length === 0) rows.push(outageRow(base, old)); // outage: keep old parts; with none stored, stay unattempted so a re-run retries
    else if (parts.length) rows.push({ ...base, parts, partsSource: "model", namesFingerprint: fingerprint });
    else rows.push({ ...base, partsSource: "none", partsReason: "no valid parts returned", namesFingerprint: fingerprint });
  }
  convexRun("media:replaceChapters", { eventId, chapters: rows });
  return rows;
}

async function main() {
  process.loadEnvFile(".env.local");
  const args = process.argv.slice(2);
  const reconfirm = args.includes("--reconfirm");
  const reparts = args.includes("--reparts");
  const eventId = Number(args.find((a) => !a.startsWith("--")));
  if (!eventId) throw new Error("usage: ingest-meeting.ts <eventId> [--reconfirm] [--reparts] [--captions]");
  const ev = convexRun<{ bodyId: number; clipId: number | null } | null>("media:eventByLegistarId", { legistarId: eventId });
  if (!ev) throw new Error(`event ${eventId} not found in Convex`);

  const { turns, source } = await loadTurns(eventId, ev.clipId, args.includes("--captions"));
  const stale = await writeTurns(eventId, turns, source);
  let assignments: SpeakerAssignment[] = [];
  let reused = 0;
  let newConf = 0;
  if (source === "transcript") ({ validated: assignments, reused, newConf } = await nameStep(eventId, ev.bodyId, turns, reconfirm));
  else convexRun("media:replaceAssignments", { eventId, assignments: [] });
  const chapters = await chapterStep(eventId, turns, assignments, source === "transcript", reconfirm, reparts);

  const hiddenLabels = convexRun<{ label: string; hidden?: boolean }[]>("media:overridesForEvent", { eventId }).filter((o) => o.hidden).map((o) => o.label);
  const named = nameSpeakers(turns, assignments, hiddenLabels).filter((n) => !/^(Speaker |Unidentified)/.test(n.display)).length;
  const located = chapters.filter((c) => c.located !== "not-located").length;
  console.log(
    `event ${eventId} [${source}]: turns ${turns.length} (stale removed ${stale}), named ${named}/${turns.length} (${turns.length ? ((100 * named) / turns.length).toFixed(1) : 0}%), ` +
      `assignments ${assignments.length}, chapters located ${located}/${chapters.length}, with parts ${chapters.filter((c) => c.parts.length).length}, ` +
      `confirmations reused ${reused} / new ${newConf}, Muse Spark calls ${sparkCalls} (errors ${sparkErrors})`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
