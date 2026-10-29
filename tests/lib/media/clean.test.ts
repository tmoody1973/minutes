import { describe, expect, it } from "vitest";
import { cleanQuote } from "@/lib/media/clean";

const none = new Map<string, string>();
const dcd = new Map([["DCDCD", "DCD"]]);

describe("cleanQuote: repeated words", () => {
  it("collapses an immediately repeated word", () => {
    expect(cleanQuote("a substitute substitute ordinance", none)).toBe("a substitute ordinance");
  });

  it("keeps the trailing punctuation of the last repeat", () => {
    expect(cleanQuote("phase phase one,", none)).toBe("phase one,");
  });

  it("keeps the first token's casing", () => {
    expect(cleanQuote("the The plan", none)).toBe("the plan");
  });

  it("collapses runs of three or more", () => {
    expect(cleanQuote("the the the plan", none)).toBe("the plan");
  });

  it("does not duplicate punctuation already on the first token", () => {
    expect(cleanQuote("motion? motion?", none)).toBe("motion?");
  });

  it("takes trailing punctuation from the last token of the run", () => {
    expect(cleanQuote("was the the, uh", none)).toBe("was the, uh");
  });

  it("keeps closing punctuation from the last token, replacing the first", () => {
    expect(cleanQuote("no, no?", none)).toBe("no?");
    expect(cleanQuote("yes, yes.", none)).toBe("yes.");
    expect(cleanQuote("the the,", none)).toBe("the,");
  });

  it("keeps leading punctuation from the first token", () => {
    expect(cleanQuote("(the the plan", none)).toBe("(the plan");
  });

  it("does not treat punctuation-only tokens as words", () => {
    expect(cleanQuote("- - go", none)).toBe("- - go");
  });

  it("leaves repeated numbers as heard", () => {
    expect(cleanQuote("Ward 3 3", none)).toBe("Ward 3 3");
    expect(cleanQuote("1. 1.", none)).toBe("1. 1.");
  });

  it("does not collapse non-adjacent repeats", () => {
    expect(cleanQuote("the plan the plan", none)).toBe("the plan the plan");
  });

  it("keeps the original line break before a collapsed run", () => {
    expect(cleanQuote("line one\n\nthe the plan", none)).toBe("line one\n\nthe plan");
  });

  it("returns text with no repeats and no corrections unchanged, spacing included", () => {
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
