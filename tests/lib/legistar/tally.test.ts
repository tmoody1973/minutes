import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeTally } from "@/lib/legistar/tally";
import { parseVote } from "@/lib/legistar/parse";

const fx = (name: string) =>
  JSON.parse(readFileSync(`tests/fixtures/legistar/${name}.json`, "utf8"));

const votesFor = (name: string, eventItemId: number) =>
  fx(name).map((raw: Record<string, unknown>) => parseVote(raw, eventItemId));

describe("computeTally", () => {
  it("tallies Council item 496980", () => {
    expect(computeTally(votesFor("votes-496980", 496980))).toEqual({
      aye: 13,
      no: 0,
      excused: 2,
      other: 0,
    });
  });

  it("tallies Plan Commission item 495638", () => {
    expect(computeTally(votesFor("votes-495638", 495638))).toEqual({
      aye: 5,
      no: 0,
      excused: 2,
      other: 0,
    });
  });

  it("returns all zeros for an empty list", () => {
    expect(computeTally([])).toEqual({ aye: 0, no: 0, excused: 0, other: 0 });
  });
});
