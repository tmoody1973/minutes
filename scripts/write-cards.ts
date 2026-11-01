// Usage: npx tsx scripts/write-cards.ts [file|chapter|all] [key ...] [--force]
//   file 260533            one file card        chapter 13559:123456   one chapter card
//   all                    every file on the map and every chapter about a file
// The Clerk agent drafts each card from stored records; the Editor checks every sentence; only passing sentences are
// saved on DEV (all verdicts are logged). Cards whose records have not changed are skipped unless --force.
// META_API_KEY comes from .env.local.
import { createHash } from "node:crypto";
import { editorCheck } from "../lib/editor/check";
import { writeCard } from "../lib/writer/cards";
import { convexRun } from "./convex-run";

process.loadEnvFile(".env.local");
// Bump a kind's version when its writer prompt (or the Editor's) changes, so those cards are rewritten.
const PROMPT_VERSION = { file: "3", chapter: "3" };

type Kind = "file" | "chapter";
type Src = { key: string; label: string; text: string };

async function one(kind: Kind, key: string, force: boolean): Promise<"written" | "skipped" | "missing"> {
  const { sources, storedHash } = convexRun<{ sources: Src[] | null; storedHash: string | null }>("editor:cardSources", { kind, key });
  if (!sources) return "missing";
  const hash = createHash("sha256").update(PROMPT_VERSION[kind] + JSON.stringify(sources)).digest("hex").slice(0, 16);
  if (!force && hash === storedHash) return "skipped";
  const texts = new Map(sources.map((s) => [s.key, s.text]));
  const drafted = await writeCard(kind, Object.fromEntries(texts));
  const sentences = await Promise.all(drafted.map(async (s) => ({ ...s, verdict: await editorCheck(s, texts) })));
  convexRun("editor:saveCard", { kind, key, sourcesHash: hash, sourceLabels: Object.fromEntries(sources.map((s) => [s.key, s.label])), sentences });
  for (const s of sentences) console.log(`  ${s.verdict.ok ? "PASS" : `REJECT ${s.verdict.reason}: ${s.verdict.detail}`}\n    ${s.text}  [${s.sourceKeys.join(", ")}]`);
  return "written";
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const [scope, ...keys] = args.filter((a) => a !== "--force");
  let jobs: [Kind, string][];
  if (scope === "all") {
    const t = convexRun<{ files: string[]; chapters: string[] }>("editor:cardTargets", {});
    jobs = [...t.files.map((k): [Kind, string] => ["file", k]), ...t.chapters.map((k): [Kind, string] => ["chapter", k])];
  } else if ((scope === "file" || scope === "chapter") && keys.length) {
    jobs = keys.map((k) => [scope, k]);
  } else {
    throw new Error("usage: write-cards.ts [file|chapter|all] [key ...] [--force]");
  }
  const counts = { written: 0, skipped: 0, missing: 0, failed: 0 };
  for (const [i, [kind, key]] of jobs.entries()) {
    console.log(`[${i + 1}/${jobs.length}] ${kind} ${key}`);
    try {
      counts[await one(kind, key, force)]++;
    } catch (e) {
      counts.failed++;
      console.error(`  FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(JSON.stringify(counts));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
