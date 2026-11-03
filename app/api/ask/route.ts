import { ConvexHttpClient } from "convex/browser";
import { runAgent } from "../../../lib/ask/agent";
import { convexTools } from "../../../lib/ask/convexTools";

// Ask Minutes (decision 008). Streams newline-delimited JSON: {type:"step"} lines while the agent works, then one
// {type:"answer"} or {type:"error"}. The question is never stored or logged: it can contain a home address.

const LIMIT = 10;
const WINDOW_MS = 60_000;
// ponytail: per-instance memory, so the cap is per server instance, not global; move to Convex if abuse shows up.
const recent = new Map<string, number[]>();

function allowed(ip: string, now: number): boolean {
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= LIMIT) return false;
  recent.set(ip, [...hits, now]);
  return true;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url || !process.env.META_API_KEY) return Response.json({ error: "Ask Minutes is not set up on this server." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > 500) return Response.json({ error: "Ask a question between 3 and 500 characters." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(ip, Date.now())) return Response.json({ error: "Too many questions at once. Try again in a minute." }, { status: 429 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (x: object) => controller.enqueue(encoder.encode(`${JSON.stringify(x)}\n`));
      try {
        const answer = await runAgent(question, convexTools(new ConvexHttpClient(url)), { onStep: (text) => send({ type: "step", text }) });
        send({ type: "answer", answer });
      } catch (err) {
        console.error("ask failed:", err instanceof Error ? err.message : String(err));
        send({ type: "error", message: "Minutes couldn't finish this answer. Try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
