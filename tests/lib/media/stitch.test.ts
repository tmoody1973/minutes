import { describe, expect, it } from "vitest";
import { stitchChunks, type RawTurn } from "@/lib/media/stitch";

const turn = (overrides: Partial<RawTurn> & Pick<RawTurn, "turnId" | "startMs" | "endMs">): RawTurn => ({
  transcript: "hello there",
  ...overrides,
});

describe("stitchChunks", () => {
  it("shifts chunk-relative times by the chunk offset", () => {
    const [t] = stitchChunks(1, [
      { index: 2, offsetMs: 1_190_000, turns: [turn({ turnId: 0, startMs: 5_000, endMs: 9_000, speaker: "A" })] },
    ]);
    expect(t.startMs).toBe(1_195_000);
    expect(t.endMs).toBe(1_199_000);
    expect(t.chunk).toBe(2);
    expect(t.turnKey).toBe("2:0");
    expect(t.eventId).toBe(1);
  });

  it("sorts by absolute start time across chunks", () => {
    const out = stitchChunks(1, [
      { index: 1, offsetMs: 595_000, turns: [turn({ turnId: 0, startMs: 100, endMs: 200 })] },
      { index: 0, offsetMs: 0, turns: [turn({ turnId: 1, startMs: 600_000, endMs: 600_100 })] },
      { index: 0, offsetMs: 0, turns: [turn({ turnId: 2, startMs: 50, endMs: 60 })] },
    ]);
    expect(out.map((t) => t.startMs)).toEqual([50, 595_100, 600_000]);
  });

  it("breaks start-time ties by chunk index, then original order", () => {
    const out = stitchChunks(1, [
      { index: 4, offsetMs: 0, turns: [turn({ turnId: 0, startMs: 10, endMs: 20 })] },
      { index: 3, offsetMs: 0, turns: [turn({ turnId: 1, startMs: 10, endMs: 20 }), turn({ turnId: 2, startMs: 10, endMs: 21 })] },
    ]);
    expect(out.map((t) => t.turnKey)).toEqual(["3:1", "3:2", "4:0"]);
  });

  it("namespaces speaker labels by chunk", () => {
    const out = stitchChunks(1, [
      { index: 3, offsetMs: 0, turns: [turn({ turnId: 0, startMs: 0, endMs: 5, speaker: "A" })] },
      { index: 4, offsetMs: 595_000, turns: [turn({ turnId: 0, startMs: 0, endMs: 5, speaker: "A" })] },
    ]);
    expect(out.map((t) => t.label)).toEqual(["c3:A", "c4:A"]);
    expect(out[0].label).not.toBe(out[1].label);
  });

  it("sets label to null when speaker is missing", () => {
    const [t] = stitchChunks(1, [{ index: 2, offsetMs: 0, turns: [turn({ turnId: 7, startMs: 0, endMs: 5 })] }]);
    expect(t.label).toBeNull();
    expect(t.turnKey).toBe("2:7");
  });

  it("drops turns whose transcript is empty or whitespace-only", () => {
    const out = stitchChunks(1, [
      {
        index: 0,
        offsetMs: 0,
        turns: [
          turn({ turnId: 0, startMs: 0, endMs: 5, transcript: "" }),
          turn({ turnId: 1, startMs: 5, endMs: 9, transcript: "   \n\t " }),
          turn({ turnId: 2, startMs: 9, endMs: 12, transcript: "  kept  " }),
        ],
      },
    ]);
    expect(out.map((t) => t.turnKey)).toEqual(["0:2"]);
    expect(out[0].text).toBe("kept");
  });

  it("does not mutate its input", () => {
    const chunks = [
      { index: 2, offsetMs: 1_000, turns: [turn({ turnId: 0, startMs: 5, endMs: 9, speaker: "B" })] },
    ];
    const snapshot = JSON.parse(JSON.stringify(chunks));
    stitchChunks(1, chunks);
    expect(chunks).toEqual(snapshot);
  });

  it("returns an empty array for no chunks", () => {
    expect(stitchChunks(1, [])).toEqual([]);
  });
});
