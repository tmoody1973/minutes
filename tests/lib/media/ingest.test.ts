import { describe, expect, it } from "vitest";
import { assertCaptionsAllowed, partsNames, batchBySize, candidateKey, chunkFiles, labelOrder, namesFingerprint, outageRow, partsDecision, reuseOrCall } from "@/lib/media/ingest";

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

describe("batchBySize row cap", () => {
  it("caps items per batch", () => {
    const b = batchBySize(Array.from({ length: 2500 }, (_, i) => i), 1_000_000, 1000);
    expect(b.map((x) => x.length)).toEqual([1000, 1000, 500]);
  });
});

describe("namesFingerprint", () => {
  it("is stable under order and changes when a name changes", () => {
    const a = namesFingerprint([{ label: "c0:A", name: "X" }, { label: "c0:B", name: "Y" }]);
    expect(namesFingerprint([{ label: "c0:B", name: "Y" }, { label: "c0:A", name: "X" }])).toBe(a);
    expect(namesFingerprint([{ label: "c0:A", name: "Z" }, { label: "c0:B", name: "Y" }])).not.toBe(a);
    expect(namesFingerprint([])).toBe(namesFingerprint([]));
  });
});

describe("partsDecision", () => {
  const old = { startMs: 1, endMs: 2, partsSource: "model" as const, namesFingerprint: "f" };
  const base = { window: { startMs: 1, endMs: 2 }, fingerprint: "f", reconfirm: false, reparts: false };
  it("reuses when window and fingerprint match", () => expect(partsDecision({ ...base, old })).toBe("reuse"));
  it("refreshes when a name changed", () => expect(partsDecision({ ...base, old, fingerprint: "g" })).toBe("refresh"));
  it("refreshes when the window moved", () => expect(partsDecision({ ...base, old, window: { startMs: 1, endMs: 3 } })).toBe("refresh"));
  it("refreshes with --reparts and --reconfirm", () => {
    expect(partsDecision({ ...base, old, reparts: true })).toBe("refresh");
    expect(partsDecision({ ...base, old, reconfirm: true })).toBe("refresh");
  });
  it("refreshes with no prior row, no source, or no stored fingerprint", () => {
    expect(partsDecision({ ...base, old: undefined })).toBe("refresh");
    expect(partsDecision({ ...base, old: { ...old, partsSource: undefined } })).toBe("refresh");
    expect(partsDecision({ ...base, old: { ...old, namesFingerprint: undefined } })).toBe("refresh");
  });
});

describe("outageRow", () => {
  const fresh = { eventItemId: 1, located: "cue", startMs: 1, endMs: 2, parts: [] };
  const old = { eventItemId: 1, located: "cue", startMs: 1, endMs: 2, parts: [{ kind: "testimony", startMs: 1, endMs: 2 }], partsSource: "model" as const, namesFingerprint: "f" };
  it("keeps the old parts, source and fingerprint when the window is unchanged", () => expect(outageRow(fresh, old)).toEqual(old));
  it("returns the bare unattempted row when the window moved", () => {
    const moved = { ...fresh, endMs: 3 };
    expect(outageRow(moved, old)).toEqual(moved);
    expect(outageRow({ ...fresh, startMs: 0 }, old)).not.toHaveProperty("namesFingerprint");
  });
  it("falls back to the bare row when there is no old row", () => expect(outageRow(fresh, undefined)).toEqual(fresh));
});

describe("chunkFiles", () => {
  it("sorts chunk files", () => expect(chunkFiles(["chunk_001.json", "x.txt", "chunk_000.json"], "d")).toEqual(["chunk_000.json", "chunk_001.json"]));
  it("throws on a directory with no chunks", () => expect(() => chunkFiles(["notes.txt"], "data/transcripts/1")).toThrow(/no chunk_\*\.json/));
});

describe("partsNames (hidden labels)", () => {
  const asg = [{ label: "c0:E", name: "Willie Smith", source: "legistar" as const, evidenceTurnKey: "0:1" }];
  it("hiding a label drops its name from the chapterer input and changes the fingerprint", () => {
    const before = partsNames(asg, []);
    const after = partsNames(asg, [{ label: "c0:E", name: "", hidden: true, at: 1 }]);
    expect(before.forParts.map((p) => p.name)).toEqual(["Willie Smith"]);
    expect(after.forParts).toEqual([]);
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });
  it("manual named override still passes through", () => {
    expect(partsNames(asg, [{ label: "c0:E", name: "Kristen Connolly", at: 1 }]).forParts.map((p) => p.name)).toContain("Kristen Connolly");
  });
});

describe("assertCaptionsAllowed", () => {
  it("refuses captions over stored transcript turns unless --captions", () => {
    expect(() => assertCaptionsAllowed(1, "transcript", false)).toThrow(/--captions/);
    expect(() => assertCaptionsAllowed(1, "transcript", true)).not.toThrow();
    expect(() => assertCaptionsAllowed(1, "captions", false)).not.toThrow();
    expect(() => assertCaptionsAllowed(1, "none", false)).not.toThrow();
  });
});
