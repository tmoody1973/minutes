import { describe, expect, it, vi } from "vitest";
import { LegistarError, legistarGet } from "@/lib/legistar/client";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const noSleep = async () => {};

describe("legistarGet", () => {
  it("builds the URL, sends the User-Agent and parses JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ a: 1 }));
    const out = await legistarGet("events", { $top: "5" }, { fetchImpl, sleep: noSleep });
    expect(out).toEqual({ a: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://webapi.legistar.com/v1/milwaukee/events?%24top=5");
    expect(init.headers["User-Agent"]).toBe("Minutes/0.1 (tarik@radiomilwaukee.org)");
  });

  it("retries 5xx then succeeds, with growing backoff", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(ok([1]));
    const sleep = vi.fn(async (_ms: number) => {});
    expect(await legistarGet("x", undefined, { fetchImpl, sleep })).toEqual([1]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls[1][0]).toBeGreaterThan(sleep.mock.calls[0][0]);
  });

  it("gives up after 3 retries with a LegistarError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    await expect(legistarGet("x", undefined, { fetchImpl, sleep: noSleep })).rejects.toBeInstanceOf(LegistarError);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("does not retry a 4xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    await expect(legistarGet("x", undefined, { fetchImpl, sleep: noSleep })).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
