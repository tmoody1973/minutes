const URL = "https://api.meta.ai/v1/chat/completions";
const RETRIES = 2;

type Opts = { fetchImpl?: (url: string, init: RequestInit) => Promise<Response>; sleep?: (ms: number) => Promise<void> };

// First balanced {...} in the text, respecting string literals; null if none parses.
function firstJSONObject(text: string): unknown {
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

// One Muse Spark call that must return a JSON object passing `validate`.
// Retries (2x, exponential backoff) on invalid/empty output, 429, 5xx and network errors.
export async function sparkJSON<T>(system: string, user: string, validate: (x: unknown) => x is T, opts: Opts = {}): Promise<T> {
  const key = process.env.META_API_KEY;
  if (!key) throw new Error("META_API_KEY is not set; Muse Spark calls need it in the environment (.env.local)");
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastErr = "no attempts";
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    try {
      const res = await doFetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "muse-spark-1.3",
          reasoning_effort: "low",
          max_tokens: 4000,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      if (!res.ok) throw new Error(`Muse Spark request failed: HTTP ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
      const content = body.choices?.[0]?.message?.content;
      const parsed = typeof content === "string" ? firstJSONObject(content) : null;
      if (validate(parsed)) return parsed;
      lastErr = content == null ? "empty content" : "invalid JSON shape";
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Muse Spark request failed")) throw e;
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Muse Spark gave no valid answer after ${RETRIES} retries: ${lastErr}`);
}
