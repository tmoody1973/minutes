// Usage: npx tsx scripts/name-speakers.ts <eventId> <bodyId>
// Dry run: reads data/transcripts/<eventId>/chunk_*.json, roster from DEV Convex, calls Muse Spark
// (META_API_KEY from .env.local). Prints a table. Writes nothing to Convex.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { extractCues } from "../lib/media/cues";
import { assignFromCues, confirmAssignments, nameSpeakers, validateAssignment, type RosterEntry } from "../lib/media/speakers";
import { stitchChunks } from "../lib/media/stitch";

process.loadEnvFile(".env.local");
const [eventId, bodyId] = process.argv.slice(2).map(Number);
if (!eventId || !bodyId) throw new Error("usage: name-speakers.ts <eventId> <bodyId>");

const dir = `data/transcripts/${eventId}`;
const chunks = readdirSync(dir).filter((f) => /^chunk_\d+\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
const turns = stitchChunks(eventId, chunks);
const cues = extractCues(turns);
const roster = JSON.parse(
  execFileSync("npx", ["convex", "run", "legistar:rosterForBody", JSON.stringify({ bodyId })], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
) as RosterEntry[];
const candidates = assignFromCues(turns, cues, roster);
async function main() {
const { accepted, rejected } = await confirmAssignments(candidates, turns, cues);
const guarded = accepted.filter((a) => validateAssignment(a, turns, cues, roster));
const named = nameSpeakers(turns, guarded);
const namedTurns = named.filter((n) => !/^(Speaker |Unidentified)/.test(n.display)).length;

console.log(`turns ${turns.length}, cues ${cues.length}, roster ${roster.length}, candidates ${candidates.length}, accepted ${guarded.length}, rejected ${rejected.length}`);
console.log("\nACCEPTED\nlabel\tname\tsource\tevidence");
for (const a of guarded) console.log(`${a.label}\t${a.name}\t${a.source}\t${a.evidenceTurnKey}`);
console.log("\nREJECTED\nlabel\tname\treason");
for (const r of rejected) console.log(`${r.a.label}\t${r.a.name}\t${r.reason}`);
console.log(`\nturns named: ${namedTurns}/${turns.length} (${((100 * namedTurns) / turns.length).toFixed(1)}%)`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
