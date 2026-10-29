import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sparkJSON } from "@/lib/meta/spark";

const isOk = (x: unknown): x is { ok: boolean } => typeof x === "object" && x !== null && typeof (x as { ok?: unknown }).ok === "boolean";
const reply = (content: string | null, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
const seq = (...rs: Response[]) => {
  const f = vi.fn();
  rs.forEach((r) => f.mockResolvedValueOnce(r));
  return f;
};
const sleep = vi.fn(async () => {});

beforeEach(() => {
  process.env.META_API_KEY = "k";
  sleep.mockClear();
});
afterEach(() => {
  delete process.env.META_API_KEY;
});

describe("sparkJSON", () => {
  it("sends the pinned request and parses the first JSON object in the content", async () => {
    const f = seq(reply('Sure! {"ok": true, "x": "a } b"} trailing {"ok": false}'));
    expect(await sparkJSON("sys", "usr", isOk, { fetchImpl: f, sleep })).toEqual({ ok: true, x: "a } b" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.meta.ai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer k");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "muse-spark-1.3", reasoning_effort: "low", max_tokens: 4000 });
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "usr" },
    ]);
  });

  it("retries when content is null", async () => {
    const f = seq(reply(null), reply('{"ok":true}'));
    expect(await sparkJSON("s", "u", isOk, { fetchImpl: f, sleep })).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("retries 429 and 5xx with backoff", async () => {
    const f = seq(new Response("", { status: 429 }), new Response("", { status: 503 }), reply('{"ok":false}'));
    expect(await sparkJSON("s", "u", isOk, { fetchImpl: f, sleep })).toEqual({ ok: false });
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("retries when the validator rejects, then gives up after 2 retries", async () => {
    const f = seq(reply('{"nope":1}'), reply("no json"), reply('{"nope":2}'));
    await expect(sparkJSON("s", "u", isOk, { fetchImpl: f, sleep })).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("retries network errors and timeouts, passing an abort signal", async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockRejectedValueOnce(new DOMException("timed out", "TimeoutError")).mockResolvedValueOnce(reply('{"ok":true}'));
    expect(await sparkJSON("s", "u", isOk, { fetchImpl: f as unknown as typeof fetch, sleep, timeoutMs: 5 })).toEqual({ ok: true });
    expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("gives up after repeated 5xx", async () => {
    const f = seq(new Response("", { status: 500 }), new Response("", { status: 502 }), new Response("", { status: 503 }));
    await expect(sparkJSON("s", "u", isOk, { fetchImpl: f as unknown as typeof fetch, sleep })).rejects.toThrow(/503/);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("does not retry other 4xx", async () => {
    const f = seq(new Response("", { status: 401 }));
    await expect(sparkJSON("s", "u", isOk, { fetchImpl: f, sleep })).rejects.toThrow(/401/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when META_API_KEY is missing", async () => {
    delete process.env.META_API_KEY;
    const f = vi.fn();
    await expect(sparkJSON("s", "u", isOk, { fetchImpl: f, sleep })).rejects.toThrow(/META_API_KEY/);
    expect(f).not.toHaveBeenCalled();
  });
});
