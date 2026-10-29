// Usage: npx tsx scripts/speakers.ts list <eventId>
//        npx tsx scripts/speakers.ts list <eventId> --item <fileNumber>   (only voices speaking in that agenda item)
//        npx tsx scripts/speakers.ts set <eventId> <label> "<name>"
//        npx tsx scripts/speakers.ts hide <eventId> <label>   (label shows as Speaker X)
//        npx tsx scripts/speakers.ts clear <eventId> <label>
// Manual speaker review (Ruling 12). Overrides apply on read; no re-ingest needed. DEV only.
import { extractCues } from "../lib/media/cues";
import { labelOrder } from "../lib/media/ingest";
import { granicusLink, labelChapters, selfIntroName, spellingHints, type ChapterRef } from "../lib/media/review";
import { convexRun } from "./convex-run";

type View = { turns: { startMs: number; endMs: number; turnKey: string; label: string | null; text: string; display: string; asHeard: boolean }[] };
type Ctx = { clipId: number | null; chapters: (ChapterRef & { minutesNote?: string })[] };
type Row = { label: string; name: string; source: string; hidden?: boolean };

const trunc = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}...` : s);

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const wrap = (s: string, indent: string, width = 100) =>
  s.split(/\s+/).reduce<string[]>((lines, w) => {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + w.length <= width - indent.length) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
    return lines;
  }, []).map((l) => indent + l).join("\n");
const itemName = (c: { fileNumber?: string; title?: string }) => `${c.fileNumber ?? "(no file)"} \u00b7 ${c.title ?? ""}`;

function list(eventId: number, item?: string) {
  const view = convexRun<View>("media:meetingView", { eventId });
  const assignments = convexRun<Row[]>("media:assignmentsForEvent", { eventId });
  const overrides = convexRun<Row[]>("media:overridesForEvent", { eventId });
  const ctx = convexRun<Ctx>("media:reviewContext", { eventId });
  // Names speakers gave themselves on air (cues only; nothing is assigned from them).
  const selfNames = new Map<string, string>();
  for (const c of extractCues(view.turns.map((t) => ({ ...t, eventId, chunk: Number(t.turnKey.split(":")[0]), label: t.label })))) {
    const l = view.turns.find((t) => t.turnKey === c.targetTurnKey)?.label;
    if (c.kind === "self" && l && !selfNames.has(l)) selfNames.set(l, c.name);
  }
  const printed = new Set<number>(); // each chapter's minutes note prints once
  const note = (c: Ctx["chapters"][number]) => {
    if (printed.has(c.eventItemId)) return;
    printed.add(c.eventItemId);
    console.log(`  Minutes, ${itemName(c)}:\n${c.minutesNote ? wrap(c.minutesNote, "    ") : "    (no minutes text yet)"}`);
  };
  if (item) {
    const c = ctx.chapters.find((x) => x.fileNumber === item);
    if (!c) throw new Error(`no chapter for file ${item} in event ${eventId}`);
    note(c);
  }
  for (const label of labelOrder(view.turns)) {
    const mine = view.turns.filter((t) => t.label === label);
    const chs = labelChapters(view.turns, ctx.chapters, label).map((lc) => ctx.chapters.find((c) => c.eventItemId === lc.eventItemId)!);
    if (item && !chs.some((c) => c.fileNumber === item)) continue;
    const ov = overrides.find((o) => o.label === label);
    const a = assignments.find((x) => x.label === label);
    const src = ov?.hidden ? "hidden" : ov ? "manual" : a?.source ?? "none";
    console.log(`${label}\t${mine[0].display}${mine[0].asHeard ? " (name as heard)" : ""}\t[${src}]\t${mine.length} turns`);
    const first = mine[0];
    console.log(`  first at ${mmss(first.startMs)}${ctx.clipId ? `  ${granicusLink(ctx.clipId, first.startMs)}` : ""}`);
    for (const c of chs) console.log(`  item: ${itemName(c)}`);
    // Hints only for names the speaker gave themselves (or that came from a self-intro); suggestions, never applied.
    const heard = ov ? undefined : a?.source === "self-intro" ? a.name : selfNames.get(label) ?? mine.map((t) => selfIntroName(t.text)).find(Boolean);
    if (heard) {
      const hints = [...new Set(chs.flatMap((c) => (c.minutesNote ? spellingHints(heard, c.minutesNote) : [])))];
      if (hints.length) console.log(`  minutes spelling (heard "${heard}"): ${hints.join(", ")}`);
    }
    for (const t of mine.slice(0, 2)) console.log(`    ${trunc(t.text)}`);
    if (!item) for (const c of chs) note(c);
  }
}

function knownLabels(eventId: number): string[] {
  return labelOrder(convexRun<View>("media:meetingView", { eventId }).turns);
}

process.stdout.on("error", (e: NodeJS.ErrnoException) => { if (e.code === "EPIPE") process.exit(0); throw e; }); // `| head`
const argv = process.argv.slice(2);
const itemAt = argv.indexOf("--item");
const itemArg = itemAt >= 0 ? argv.splice(itemAt, 2)[1] : undefined;
const [cmd, idArg, label, ...rest] = argv;
const eventId = Number(idArg);
try {
  if (!eventId) throw new Error("usage: speakers.ts list|set|hide|clear <eventId> ...");
  if (cmd === "list") list(eventId, itemArg);
  else if (cmd === "set" || cmd === "clear" || cmd === "hide") {
    if (!label || !knownLabels(eventId).includes(label)) throw new Error(`unknown label "${label ?? ""}" for event ${eventId}; run: speakers.ts list ${eventId}`);
    if (cmd === "set") {
      const name = rest.join(" ").trim();
      if (!name) throw new Error("name must not be empty");
      convexRun("media:setOverride", { eventId, label, name, by: "tarik", at: Date.now() });
      console.log(`set ${label} -> ${name}`);
    } else if (cmd === "hide") {
      convexRun("media:setOverride", { eventId, label, hidden: true, by: "tarik", at: Date.now() });
      console.log(`hid ${label} (shows as Speaker X)`);
    } else {
      const r = convexRun<{ cleared: number }>("media:clearOverride", { eventId, label });
      console.log(`cleared ${r.cleared} override(s) for ${label}`);
    }
  } else throw new Error("usage: speakers.ts list|set|hide|clear <eventId> ...");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
