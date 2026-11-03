const URL = "https://api.meta.ai/v1/chat/completions";
const RETRIES = 2;

type Opts = {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

// Non-retryable failure (auth, bad request): thrown straight through the retry loop.
class SparkFatalError extends Error {}

// First balanced {...} in the text, respecting string literals; null if none parses.
export function firstJSONObject(text: string): unknown {
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inStr = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (c === "\\") i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

type Accept<T> = { ok: true; value: T } | { ok: false; why: string };
type Body = { choices?: { message?: ChatMessage }[] };

// One Muse Spark request. Retries (2x, exponential backoff) on output `accept` refuses, 429, 5xx and network errors.
async function request<T>(payload: Record<string, unknown>, accept: (body: Body) => Accept<T>, opts: Opts): Promise<T> {
  const key = process.env.META_API_KEY;
  if (!key) throw new Error("META_API_KEY is not set; Muse Spark calls need it in the environment (.env.local)");
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastErr = "no attempts";
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    try {
      const res = await doFetch(URL, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "muse-spark-1.3", reasoning_effort: "low", max_tokens: 4000, ...payload }),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      if (!res.ok) throw new SparkFatalError(`Muse Spark request failed: HTTP ${res.status}`);
      const got = accept((await res.json()) as Body);
      if (got.ok) return got.value;
      lastErr = got.why;
    } catch (e) {
      if (e instanceof SparkFatalError) throw e;
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Muse Spark gave no valid answer after ${RETRIES} retries: ${lastErr}`);
}

// One Muse Spark call that must return a JSON object passing `validate`.
export function sparkJSON<T>(system: string, user: string, validate: (x: unknown) => x is T, opts: Opts = {}): Promise<T> {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  return request({ messages }, (body) => {
    const content = body.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? firstJSONObject(content) : null;
    if (validate(parsed)) return { ok: true, value: parsed };
    return { ok: false, why: content == null ? "empty content" : "invalid JSON shape" };
  }, opts);
}

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content?: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

// One turn of a tool-using conversation (Ask Minutes): the assistant message, which may ask for tool calls.
export function sparkChat(messages: ChatMessage[], tools?: ToolSpec[], opts: Opts = {}): Promise<ChatMessage & { role: "assistant" }> {
  return request({ messages, ...(tools?.length ? { tools } : {}) }, (body) => {
    const m = body.choices?.[0]?.message as (ChatMessage & { role: "assistant" }) | undefined;
    if (m && (m.tool_calls?.length || (typeof m.content === "string" && m.content.trim()))) return { ok: true, value: { ...m, role: "assistant" } };
    return { ok: false, why: "empty message" };
  }, opts);
}
