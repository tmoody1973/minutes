// Usage: npx tsx scripts/ingest-captions-all.ts [--since 2026-01-01] [--limit N]
// Gives every past meeting without chapters its chapters from the city's own captions, newest first, by running
// ingest-meeting.ts --captions on each. No model calls. Skips meetings with no video, empty captions, or more caption
// lines than the meeting page can return at once. CONVEX_RUN_PROD=1 targets production (Tarik runs that).
import { execFileSync } from "node:child_process";
import { convexRun } from "./convex-run";

const UA = "Minutes/0.1 (tarik@radiomilwaukee.org)";
// meetingView returns every turn; Convex caps one return value at 8,192 items, so leave room.
const MAX_LINES = 7500;

type Meeting = { eventId: number; bodyName: string; startsAt: string; chapters: number };

// One retry: the city's caption server drops an occasional request, and one drop shouldn't end a 200-meeting run.
async function captionLines(clipId: number, tries = 2): Promise<number | null> {
  try {
    const res = await fetch(`https://milwaukee.granicus.com/videos/${clipId}/captions.vtt`, { headers: { "User-Agent": UA } });
    if (res.status !== 200) return 0;
    return ((await res.text()).match(/-->/g) ?? []).length;
  } catch {
    return tries > 1 ? captionLines(clipId, tries - 1) : null;
  }
}

async function main() {
  process.loadEnvFile(".env.local");
  const args = process.argv.slice(2);
  const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const since = flag("--since") ?? "2026-01-01";
  const limit = Number(flag("--limit") ?? Infinity);
  const now = Date.now();
  const todo = convexRun<Meeting[]>("media:meetingList", {}).filter((m) => !m.chapters && Date.parse(m.startsAt) < now && m.startsAt >= since);
  console.log(`${todo.length} past meetings without chapters since ${since}`);
  const tally = { done: 0, noVideo: 0, noCaptions: 0, tooLong: 0, failed: 0 };
  for (const m of todo) {
    if (tally.done >= limit) break;
    const ev = convexRun<{ clipId: number | null } | null>("media:eventByLegistarId", { legistarId: m.eventId });
    const label = `${m.eventId} ${m.startsAt.slice(0, 10)} ${m.bodyName}`;
    if (!ev?.clipId) {
      tally.noVideo++;
      continue;
    }
    const lines = await captionLines(ev.clipId);
    if (lines === null) {
      tally.failed++;
      console.log(`FAILED (captions unreachable): ${label}`);
      continue;
    }
    if (!lines) {
      tally.noCaptions++;
      continue;
    }
    if (lines > MAX_LINES) {
      tally.tooLong++;
      console.log(`skip (too long, ${lines} lines): ${label}`);
      continue;
    }
    try {
      const out = execFileSync("npx", ["tsx", "scripts/ingest-meeting.ts", String(m.eventId), "--captions"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      tally.done++;
      console.log(`ok: ${label} · ${out.trim().split("\n").at(-1)?.replace(/^event \d+ \[captions\]: /, "")}`);
    } catch (e) {
      tally.failed++;
      console.log(`FAILED: ${label} · ${e instanceof Error ? e.message.split("\n").find((l) => /Error|error/.test(l)) ?? e.message.split("\n")[0] : e}`);
    }
  }
  console.log(JSON.stringify(tally));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
