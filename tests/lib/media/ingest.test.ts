import { describe, expect, it } from "vitest";
import { batchBySize, candidateKey, labelOrder, reuseOrCall } from "@/lib/media/ingest";

describe("batchBySize", () => {
  it("splits so each batch JSON stays under the limit", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ i, pad: "x".repeat(100) }));
    const batches = batchBySize(items, 400);
    expect(batches.flat()).toEqual(items);
    for (const b of batches) expect(JSON.stringify(b).length).toBeLessThanOrEqual(400);
    expect(batches.length).toBeGreaterThan(1);
  });
  it("puts an oversized single item alone and returns [] for empty", () => {
    expect(batchBySize([{ a: "x".repeat(1000) }, { a: "y" }], 100)).toEqual([[{ a: "x".repeat(1000) }], [{ a: "y" }]]);
    expect(batchBySize([], 100)).toEqual([]);
  });
});

describe("candidateKey", () => {
  it("joins label|name|evidenceTurnKey", () => {
    expect(candidateKey({ label: "c1:A", name: "Jane Doe", evidenceTurnKey: "0:3" })).toBe("c1:A|Jane Doe|0:3");
  });
});

describe("reuseOrCall", () => {
  const stored = new Map([["k1", { confirm: true, reason: "ok" }]]);
  it("reuses a stored verdict", () => expect(reuseOrCall("k1", stored, false)).toBe("reuse"));
  it("calls for a new candidate", () => expect(reuseOrCall("k2", stored, false)).toBe("call"));
  it("--reconfirm forces a call", () => expect(reuseOrCall("k1", stored, true)).toBe("call"));
});

describe("labelOrder", () => {
  it("orders labels by first appearance, skipping null", () => {
    const turns = [{ label: "c0:B" }, { label: null }, { label: "c0:A" }, { label: "c0:B" }] as { label: string | null }[];
    expect(labelOrder(turns)).toEqual(["c0:B", "c0:A"]);
  });
});
