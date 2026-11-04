// Usage: npx tsx scripts/ingest-docs.ts [--since 2026-09-01] [--limit N]
// Downloads the PDFs attached to active files (a step since --since, or on an agenda still to come), turns each into
// text with pdftotext (poppler), and stores short passages for Ask's find_in_documents. No model calls. A PDF already
// stored is skipped; one with no text (a scan) is stored empty so it is not downloaded again; a failed download is
// left for the next run. CONVEX_RUN_PROD=1 targets production (Tarik runs that).
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toPassages } from "../lib/docs/passages";
import { convexRun } from "./convex-run";

const UA = "Minutes/0.1 (tarik@radiomilwaukee.org)";
const CONCURRENCY = 4;
// One save call carries about this much text (the CLI passes it as an argument), whatever the number of documents.
const SAVE_BYTES = 300_000;
const MAX_PDF_BYTES = 25_000_000;

type Target = { hyperlink: string; name: string; matterId: number; fileNumber: string };
type Doc = Target & { passages: string[] };

const dir = mkdtempSync(join(tmpdir(), "minutes-docs-"));
// Why downloads failed ("timeout", "ECONNRESET", "HTTP 503"), printed at the end.
const reasons = new Map<string, number>();
const failedBecause = (why: string) => {
  reasons.set(why, (reasons.get(why) ?? 0) + 1);
  return null;
};

async function textOf(t: Target, i: number): Promise<string[] | null> {
  let bytes: Buffer;
  try {
    const res = await fetch(t.hyperlink, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
    if (res.status !== 200) return failedBecause(`HTTP ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    return failedBecause(err.name === "TimeoutError" ? "timeout" : (err.cause?.code ?? err.message)); // try again next run
  }
  if (bytes.length > MAX_PDF_BYTES || bytes.subarray(0, 4).toString() !== "%PDF") return [];
  const file = join(dir, `${i}.pdf`);
  writeFileSync(file, bytes);
  try {
    return toPassages(execFileSync("pdftotext", ["-enc", "UTF-8", file, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return []; // unreadable PDF: recorded empty
  } finally {
    rmSync(file, { force: true });
  }
}

async function main() {
  process.loadEnvFile(".env.local");
  const args = process.argv.slice(2);
  const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const since = flag("--since") ?? "2026-09-01";
  const limit = Number(flag("--limit") ?? Infinity);
  const all = convexRun<Target[]>("documents:targets", { since, now: new Date().toISOString() });
  const stored = new Set<string>();
  for (let i = 0; i < all.length; i += 500) for (const h of convexRun<string[]>("documents:storedHyperlinks", { hyperlinks: all.slice(i, i + 500).map((t) => t.hyperlink) })) stored.add(h);
  const todo = all.filter((t) => !stored.has(t.hyperlink)).slice(0, limit);
  console.log(`${all.length} PDFs on active files since ${since}; ${stored.size} already stored; ${todo.length} to do`);

  const tally = { withText: 0, empty: 0, failed: 0, passages: 0 };
  let pending: Doc[] = [];
  let pendingBytes = 0;
  const flush = () => {
    if (pending.length) convexRun("documents:saveDocs", { docs: pending });
    pending = [];
    pendingBytes = 0;
  };
  const failed: Target[] = [];
  const take = async (t: Target, i: number) => {
    const passages = await textOf(t, i);
    if (passages === null) return void failed.push(t);
    if (passages.length) tally.withText++;
    else tally.empty++;
    tally.passages += passages.length;
    pending.push({ ...t, passages });
    pendingBytes += passages.reduce((n, p) => n + p.length, 0);
    if (pendingBytes >= SAVE_BYTES) flush();
  };
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const i = next++;
      await take(todo[i], i);
      if ((i + 1) % 100 === 0) console.log(`${i + 1}/${todo.length} ${JSON.stringify({ ...tally, failed: failed.length })}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // A save blocks the process, so a download in flight during a slow one can time out. Retry those one at a time.
  if (failed.length) {
    console.log(`retrying ${failed.length} failed downloads one at a time; first pass: ${JSON.stringify([...reasons])}`);
    reasons.clear();
    for (const [i, t] of failed.splice(0).entries()) await take(t, todo.length + i);
  }
  flush();
  rmSync(dir, { recursive: true, force: true });
  console.log(JSON.stringify({ ...tally, failed: failed.length }), failed.length ? JSON.stringify([...reasons]) : "");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
});
