// Usage: npx tsx scripts/speakers.ts list <eventId>
//        npx tsx scripts/speakers.ts set <eventId> <label> "<name>"
//        npx tsx scripts/speakers.ts hide <eventId> <label>   (label shows as Speaker X)
//        npx tsx scripts/speakers.ts clear <eventId> <label>
// Manual speaker review (Ruling 12). Overrides apply on read; no re-ingest needed. DEV only.
import { labelOrder } from "../lib/media/ingest";
import { convexRun } from "./convex-run";

type View = { turns: { turnKey: string; label: string | null; text: string; display: string; asHeard: boolean }[] };
type Row = { label: string; name: string; source: string; hidden?: boolean };

const trunc = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}...` : s);

function list(eventId: number) {
  const view = convexRun<View>("media:meetingView", { eventId });
  const assignments = convexRun<Row[]>("media:assignmentsForEvent", { eventId });
  const overrides = convexRun<Row[]>("media:overridesForEvent", { eventId });
  for (const label of labelOrder(view.turns)) {
    const mine = view.turns.filter((t) => t.label === label);
    const ov = overrides.find((o) => o.label === label);
    const src = ov?.hidden ? "hidden" : ov ? "manual" : assignments.find((a) => a.label === label)?.source ?? "none";
    console.log(`${label}\t${mine[0].display}${mine[0].asHeard ? " (name as heard)" : ""}\t[${src}]\t${mine.length} turns`);
    for (const t of mine.slice(0, 2)) console.log(`    ${trunc(t.text)}`);
  }
}

function knownLabels(eventId: number): string[] {
  return labelOrder(convexRun<View>("media:meetingView", { eventId }).turns);
}

const [cmd, idArg, label, ...rest] = process.argv.slice(2);
const eventId = Number(idArg);
try {
  if (!eventId) throw new Error("usage: speakers.ts list|set|hide|clear <eventId> ...");
  if (cmd === "list") list(eventId);
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
