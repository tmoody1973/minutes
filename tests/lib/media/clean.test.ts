import { describe, expect, it } from "vitest";
import { cleanQuote } from "@/lib/media/clean";

const none = new Map<string, string>();
const dcd = new Map([["DCDCD", "DCD"]]);

describe("cleanQuote: repeated words collapse", () => {
  it.each([
    ["a substitute substitute ordinance", "a substitute ordinance"],
    ["phase phase one,", "phase one,"],
    ["the The plan", "the plan"],
    ["the the the plan", "the plan"],
    ["was the the, uh", "was the, uh"],
    ["the the,", "the,"],
    ["(the the plan", "(the plan"],
    ["so so. the the plan", "so. the plan"],
    ["line one\n\nthe the plan", "line one\n\nthe plan"],
  ])("%j -> %j", (input, expected) => {
    expect(cleanQuote(input, none)).toBe(expected);
  });
});

describe("cleanQuote: punctuation inside a run is never dropped", () => {
  it.each([
    "No. no",
    "motion? motion?",
    "no, no?",
    "yes, yes.",
    '"yes" yes',
    "(the) the plan",
  ])("leaves %j unchanged", (input) => {
    expect(cleanQuote(input, none)).toBe(input);
  });
});

describe("cleanQuote: numbers and non-words", () => {
  it.each(["Ward 3 3", "1. 1.", "- - go", "the plan the plan"])("leaves %j unchanged", (input) => {
    expect(cleanQuote(input, none)).toBe(input);
  });
});

describe("cleanQuote: whitespace", () => {
  it("returns text with no edits unchanged, spacing included", () => {
    const text = "  Item  4.   Public   hearing ";
    expect(cleanQuote(text, none)).toBe(text);
  });
});

describe("cleanQuote: corrections", () => {
  it("replaces an exact whole-word match and keeps surrounding punctuation", () => {
    expect(cleanQuote("see DCDCD, please", dcd)).toBe("see DCD, please");
  });

  it("keeps leading punctuation around a correction", () => {
    expect(cleanQuote("(DCDCD)", dcd)).toBe("(DCD)");
  });

  it("leaves a longer token that only contains the key untouched", () => {
    expect(cleanQuote("DCDCDX is here", dcd)).toBe("DCDCDX is here");
  });

  it("matches case-sensitively", () => {
    expect(cleanQuote("dcdcd is here", dcd)).toBe("dcdcd is here");
  });

  it("applies corrections after collapsing repeats", () => {
    expect(cleanQuote("DCDCD DCDCD, plan", dcd)).toBe("DCD, plan");
  });

  it("applies a key with punctuation only to the exact token", () => {
    const abbrev = new Map([["U.S.", "US"]]);
    expect(cleanQuote("the U.S. plan", abbrev)).toBe("the US plan");
    expect(cleanQuote("U.S., plan", abbrev)).toBe("U.S., plan");
  });

  it("keeps original spacing when only a correction applies", () => {
    expect(cleanQuote("see  DCDCD  now", dcd)).toBe("see  DCD  now");
  });

  it("returns text unchanged when the map is empty and nothing repeats", () => {
    expect(cleanQuote("nothing to see", none)).toBe("nothing to see");
  });
});
