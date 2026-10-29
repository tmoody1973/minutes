import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseVtt } from "@/lib/media/vtt";

const fixture = readFileSync("tests/fixtures/captions/clip-5349.vtt", "utf8");

describe("parseVtt", () => {
  it("parses the real Granicus caption file into turns", () => {
    const turns = parseVtt(fixture, 5349);
    expect(turns.length).toBeGreaterThanOrEqual(500);
    expect(turns.length).toBe(503);
    expect(turns[0]).toEqual({
      eventId: 5349,
      turnKey: "cap:0",
      chunk: -1,
      startMs: 900,
      endMs: 2900,
      label: null,
      text: "Between a crate",
    });
  });

  it("keeps overlapping cue times and order as written", () => {
    const turns = parseVtt(fixture, 5349);
    expect(turns[1]).toMatchObject({ turnKey: "cap:1", startMs: 2440, endMs: 4440 });
  });

  it("accepts CRLF line endings", () => {
    const vtt = "WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nHello there\r\n\r\n";
    expect(parseVtt(vtt, 1)).toEqual([
      { eventId: 1, turnKey: "cap:0", chunk: -1, startMs: 1000, endMs: 2000, label: null, text: "Hello there" },
    ]);
  });

  it("accepts MM:SS.mmm timings without an hours part", () => {
    const vtt = "WEBVTT\n\n01:30.250 --> 01:32.500\nMinutes text\n";
    expect(parseVtt(vtt, 1)[0]).toMatchObject({ startMs: 90250, endMs: 92500, text: "Minutes text" });
  });

  it("skips a cue identifier line before the timing", () => {
    const vtt = "WEBVTT\n\n1\n00:00:03.000 --> 00:00:04.000 align:start position:0%\nWith an id\n";
    expect(parseVtt(vtt, 1)).toEqual([
      { eventId: 1, turnKey: "cap:0", chunk: -1, startMs: 3000, endMs: 4000, label: null, text: "With an id" },
    ]);
  });

  it("strips a leading >> speaker marker", () => {
    const vtt = "WEBVTT\n\n00:00:05.000 --> 00:00:06.000\n>> Chair speaking\n";
    expect(parseVtt(vtt, 1)[0].text).toBe("Chair speaking");
  });

  it("skips cues whose text is empty after stripping", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n\n00:00:02.000 --> 00:00:03.000\n>>   \n\n00:00:03.000 --> 00:00:04.000\nKept\n";
    const turns = parseVtt(vtt, 1);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ turnKey: "cap:2", text: "Kept" });
  });

  it("joins multi-line cue text with a space", () => {
    const vtt = "WEBVTT\n\n00:00:07.000 --> 00:00:09.000\n>> First line\nsecond line\n";
    expect(parseVtt(vtt, 1)[0].text).toBe("First line second line");
  });

  it("returns no turns for a header-only file", () => {
    expect(parseVtt("WEBVTT\n", 1)).toEqual([]);
  });
});
