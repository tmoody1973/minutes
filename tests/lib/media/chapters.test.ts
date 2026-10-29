import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { extractCues } from "@/lib/media/cues";
import { alignChapters, proposeParts, partsProblem, validateParts } from "@/lib/media/chapters";
import { parseEventItem } from "@/lib/legistar/parse";
import type { Chapter, ChapterPart, EventItemRecord, SpeakerAssignment, Turn } from "@/lib/types";

const items = (JSON.parse(readFileSync("tests/fixtures/legistar/eventitems-13559.json", "utf8")) as Record<string, unknown>[]).map(parseEventItem);
const END = 9_000_000;
const turn = (i: number, startMs: number, endMs: number, text = "words", label: string | null = "c0:A"): Turn => ({
  eventId: 13559, turnKey: `0:${i}`, chunk: 0, startMs, endMs, label, text,
});

describe("alignChapters", () => {
  it("keeps exactly the 7 chapterable items (Ruling 18)", () => {
    const ids = alignChapters(items, [], END).map((c) => c.eventItemId);
    expect(ids).toEqual([495632, 495634, 495636, 495638, 495640, 495642, 495644]);
  });

  it("drops removed items", () => {
    const removed = items.map((i) => (i.legistarId === 495636 ? { ...i, removedAt: 1 } : i));
    expect(alignChapters(removed, [], END).map((c) => c.eventItemId)).not.toContain(495636);
  });

  it("locates by video index and ends at the next located start", () => {
    const cs = alignChapters(items, [], END);
    const by = (id: number) => cs.find((c) => c.eventItemId === id)!;
    expect(by(495632)).toMatchObject({ startMs: 118000, endMs: 192000, located: "video-index", parts: [] });
    expect(by(495638)).toMatchObject({ startMs: 829000, endMs: 2051000, located: "video-index" });
    expect(by(495640)).toMatchObject({ startMs: 2051000, endMs: 5832000 });
    expect(by(495642)).toMatchObject({ startMs: 5832000, endMs: END });
  });

  it("ends a chapter at the next located start in time order, skipping unlocated ones", () => {
    const base: EventItemRecord = { legistarId: 1, eventId: 1, sequence: 1, matterId: 1, title: "a", videoStartSec: 10 };
    const cs = alignChapters(
      [base, { ...base, legistarId: 2, sequence: 2, videoStartSec: undefined, fileNumber: "999999" }, { ...base, legistarId: 3, sequence: 3, videoStartSec: 50 }],
      [],
      900_000,
    );
    expect(cs.map((c) => [c.startMs, c.endMs, c.located])).toEqual([[10000, 50000, "video-index"], [null, null, "not-located"], [50000, 900000, "video-index"]]);
  });

  it("locates an unindexed item by 'item number 16' cue at or after the previous start", () => {
    const turns = [turn(1, 100_000, 110_000, "item number 16 is the city plan"), turn(2, 6_000_000, 6_010_000, "We now take up item number 16.")];
    const c = alignChapters(items, turns, END).find((x) => x.eventItemId === 495644)!;
    expect(c).toMatchObject({ startMs: 6_000_000, endMs: END, located: "cue" });
  });

  it("locates by a read-aloud file number with spaces", () => {
    const c = alignChapters(items, [turn(1, 6_100_000, 6_110_000, "File 26 07 23, a resolution")], END).find((x) => x.eventItemId === 495644)!;
    expect(c).toMatchObject({ startMs: 6_100_000, located: "cue" });
    const d = alignChapters(items, [turn(1, 6_100_000, 6_110_000, "file 260-723 please")], END).find((x) => x.eventItemId === 495644)!;
    expect(d.located).toBe("cue");
  });

  it("does not match digits embedded in a longer number, or 'item 160'", () => {
    const turns = [turn(1, 6_000_000, 6_001_000, "budget 12607234 and item 160")];
    const c = alignChapters(items, turns, END).find((x) => x.eventItemId === 495644)!;
    expect(c).toMatchObject({ startMs: null, endMs: null, located: "not-located" });
  });

  it("is not-located when no cue exists", () => {
    const c = alignChapters(items, [turn(1, 6_000_000, 6_001_000, "nothing relevant")], END).find((x) => x.eventItemId === 495644)!;
    expect(c).toMatchObject({ startMs: null, endMs: null, located: "not-located", parts: [] });
  });
});

describe("validateParts", () => {
  const chapter: Chapter = { eventItemId: 1, startMs: 1000, endMs: 4000, located: "video-index", parts: [] };
  const turns = [turn(1, 1000, 2000), turn(2, 2000, 3000), turn(3, 3000, 4000), turn(4, 5000, 6000)];
  const p = (kind: ChapterPart["kind"], startMs: number, endMs: number): ChapterPart => ({ kind, startMs, endMs });

  it("accepts ordered, adjacent parts on turn boundaries", () => {
    expect(validateParts([p("presentation", 1000, 2000), p("vote", 2000, 4000)], chapter, turns)).toBe(true);
  });
  it("rejects overlap", () => {
    expect(validateParts([p("presentation", 1000, 3000), p("vote", 2000, 4000)], chapter, turns)).toBe(false);
  });
  it("rejects out-of-chapter", () => {
    expect(validateParts([p("presentation", 1000, 2000), p("vote", 5000, 6000)], chapter, turns)).toBe(false);
  });
  it("rejects non-turn boundaries", () => {
    expect(validateParts([p("presentation", 1000, 2500)], chapter, turns)).toBe(false);
  });
  it("rejects unknown kind, empty-length and unlocated chapters", () => {
    expect(validateParts([{ kind: "chat", startMs: 1000, endMs: 2000 } as unknown as ChapterPart], chapter, turns)).toBe(false);
    expect(validateParts([p("vote", 2000, 2000)], chapter, turns)).toBe(false);
    expect(validateParts([p("vote", 1000, 2000)], { ...chapter, startMs: null, endMs: null, located: "not-located" }, turns)).toBe(false);
  });
});

describe("proposeParts", () => {
  const chapter: Chapter = { eventItemId: 1, startMs: 1000, endMs: 3000, located: "video-index", parts: [] };
  const turns = [turn(1, 1000, 2000, "staff presents"), turn(2, 2000, 3000, "I move to approve"), turn(3, 9000, 9500, "outside the chapter")];

  it("returns validated parts and only sends the chapter's turns, inside untrusted delimiters", async () => {
    const spark = vi.fn(async () => ({ parts: [{ kind: "presentation", startMs: 1000, endMs: 2000 }, { kind: "vote", startMs: 2000, endMs: 3000 }] }));
    const parts = await proposeParts(chapter, turns, [], spark as never);
    expect(parts).toHaveLength(2);
    const [system, user] = spark.mock.calls[0] as unknown as string[];
    expect(system).toMatch(/untrusted/);
    expect(user).toContain("<transcript>");
    expect(user).toContain("staff presents");
    expect(user).not.toContain("outside the chapter");
  });

  it("returns [] when the model output is invalid", async () => {
    const spark = vi.fn(async () => ({ parts: [{ kind: "presentation", startMs: 1000, endMs: 2500 }] }));
    expect(await proposeParts(chapter, turns, [], spark as never)).toEqual([]);
  });

  it("returns [] when Spark throws, and skips unlocated chapters without calling it", async () => {
    expect(await proposeParts(chapter, turns, [], (async () => { throw new Error("down"); }) as never)).toEqual([]);
    const spark = vi.fn();
    expect(await proposeParts({ ...chapter, startMs: null, endMs: null, located: "not-located" }, turns, [], spark as never)).toEqual([]);
    expect(spark).not.toHaveBeenCalled();
  });

  it("keeps the prompt under ~60k chars on a long chapter by truncating turn text", async () => {
    const long = Array.from({ length: 300 }, (_, i) => turn(i, i * 1000, i * 1000 + 1000, "x".repeat(2000)));
    const spark = vi.fn(async () => ({ parts: [] }));
    await proposeParts({ ...chapter, startMs: 0, endMs: 300_000 }, long, [], spark as never);
    expect((spark.mock.calls[0] as unknown as string[])[1].length).toBeLessThan(100_000);
  });
});

describe("testimony coverage", () => {
  const chapter: Chapter = { eventItemId: 1, startMs: 0, endMs: 6000, located: "video-index", parts: [] };
  const ts = [
    turn(1, 0, 1000, "Staff presents the item.", "c0:A"),
    turn(2, 1000, 2000, "My name is David Guzman and I live nearby.", "c0:B"),
    turn(3, 2000, 3000, "Kristen Connolly, DCDCD Planning, here to answer questions.", "c0:C"),
    turn(4, 3000, 6000, "Motion carries.", "c0:A"),
  ];
  const cues = extractCues(ts);
  const p = (kind: ChapterPart["kind"], startMs: number, endMs: number): ChapterPart => ({ kind, startMs, endMs });

  it("fixture turns carry the expected cues", () => {
    expect(cues.filter((c) => c.kind === "self").map((c) => [c.name, !!c.affiliation])).toContainEqual(["David Guzman", false]);
  });
  it("rejects a self-intro outside every part, naming the minute", () => {
    const why = partsProblem([p("presentation", 0, 1000), p("vote", 3000, 6000)], chapter, ts, cues, []);
    expect(why).toMatch(/self-introduction at 0\.0 min|0\.0 min \(David Guzman\)/);
    expect(validateParts([p("presentation", 0, 1000), p("vote", 3000, 6000)], chapter, ts, cues, [])).toBe(false);
  });
  it("accepts it inside testimony", () => {
    expect(validateParts([p("presentation", 0, 1000), p("testimony", 1000, 3000), p("vote", 3000, 6000)], chapter, ts, cues, [])).toBe(true);
  });
  it("accepts an affiliated self-intro outside testimony", () => {
    const only = ts.filter((t) => t.turnKey !== "0:2" && true);
    const c2 = extractCues(only).filter((c) => c.kind === "self");
    expect(validateParts([p("presentation", 0, 3000)], chapter, only, c2, [])).toBe(true);
  });
  it("skips labels with a legistar assignment", () => {
    const a: SpeakerAssignment = { label: "c0:B", name: "Ald. X", source: "legistar", evidenceTurnKey: "0:1" };
    expect(validateParts([p("presentation", 0, 1000)], chapter, ts, cues, [a])).toBe(true);
  });
});

describe("proposeParts context and retry", () => {
  const chapter: Chapter = { eventItemId: 1, startMs: 0, endMs: 6000, located: "video-index", parts: [] };
  const ts = [
    turn(1, 0, 1000, "Staff presents the item.", "c0:A"),
    turn(2, 1000, 2000, "My name is David Guzman and I live nearby.", "c0:B"),
    turn(3, 2000, 7000, "Overlapping tail turn.", "c0:A"),
  ];
  const good = { parts: [{ kind: "testimony", startMs: 1000, endMs: 2000 }] };
  const bad = { parts: [{ kind: "presentation", startMs: 0, endMs: 1000 }] };

  it("tags self-intros, speaker displays, and includes overlapping turns", async () => {
    const spark = vi.fn(async () => good);
    await proposeParts(chapter, ts, [], spark as never);
    const user = (spark.mock.calls[0] as unknown as string[])[1];
    expect(user).toContain("[introduces self: David Guzman]");
    expect(user).toContain("Speaker A");
    expect(user).toContain("Overlapping tail turn");
  });
  it("retries once with the failure reason, then succeeds", async () => {
    const spark = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(good);
    expect(await proposeParts(chapter, ts, [], spark as never)).toEqual(good.parts);
    expect(spark).toHaveBeenCalledTimes(2);
    expect((spark.mock.calls[1] as unknown as string[])[1]).toMatch(/rejected: self-introduction at 0\.0 min \(David Guzman\)/);
  });
  it("returns [] and warns after two failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spark = vi.fn(async () => bad);
    expect(await proposeParts(chapter, ts, [], spark as never)).toEqual([]);
    expect(spark).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it("truncates only the longest turn on a 300-turn chapter", async () => {
    const many = Array.from({ length: 300 }, (_, i) => turn(i, i * 1000, i * 1000 + 1000, "short text", "c0:A"));
    many[7] = { ...many[7], text: "y".repeat(3000) };
    const spark = vi.fn(async () => ({ parts: [] }));
    await proposeParts({ ...chapter, endMs: 300_000 }, many, [], spark as never);
    const user = (spark.mock.calls[0] as unknown as string[])[1];
    expect(user.length).toBeLessThan(100_000);
    expect(user).toContain("y".repeat(3000));
  });
  it("truncates the longest first when over budget, and stays in budget with 1,200 turns", async () => {
    const mk = (n: number, len: number) => Array.from({ length: n }, (_, i) => turn(i, i * 1000, i * 1000 + 1000, "z".repeat(len), "c0:A"));
    const spark = vi.fn(async () => ({ parts: [] }));
    const big = mk(300, 250); big[0] = { ...big[0], text: "L".repeat(20000) };
    await proposeParts({ ...chapter, endMs: 300_000 }, big, [], spark as never);
    const u1 = (spark.mock.calls[0] as unknown as string[])[1];
    expect(u1.length).toBeLessThan(100_000);
    expect(u1).toContain("z".repeat(250));
    expect(u1).not.toContain("L".repeat(20000));
    await proposeParts({ ...chapter, endMs: 1_200_000 }, mk(1200, 800), [], spark as never);
    expect((spark.mock.calls[1] as unknown as string[])[1].length).toBeLessThan(100_000);
  });
});
