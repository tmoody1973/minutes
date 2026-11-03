// Ask Minutes from the terminal (dev data): npx tsx scripts/ask.ts "What is the city doing about the 2027 budget?"
import { ConvexHttpClient } from "convex/browser";
import { runAgent } from "../lib/ask/agent";
import { convexTools } from "../lib/ask/convexTools";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set in .env.local");
const question = process.argv.slice(2).join(" ");
if (!question) throw new Error('usage: npx tsx scripts/ask.ts "<question>"');

async function main() {
  const started = Date.now();
  const out = await runAgent(question, convexTools(new ConvexHttpClient(url)), {
    onStep: (s) => console.log(`… ${s}`),
    onRejected: (t, why) => console.log(`✗ ${t} (${why})`),
  });
  console.log(
    `\n${out.sentences.length ? out.sentences.map((s) => `${s.text} [${s.sources.map((r) => r.label).join("; ")}]`).join("\n") : "(no answer from the records)"}`,
  );
  console.log(
    `\nrejected by the Editor: ${out.rejected} · records: ${out.records.map((r) => r.href).join(" ")} · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
