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

  it("collapses case-insensitively, keeping the first token's text", () => {
    expect(cleanQuote("the The plan", none)).toBe("the plan");
  });

  it("collapses runs of three or more", () => {
    expect(cleanQuote("the the the plan", none)).toBe("the plan");
  });

  it("does not duplicate punctuation already on the first token", () => {
    expect(cleanQuote("motion? motion?", none)).toBe("motion?");
  });

  it("appends the trailing punctuation of the last run token", () => {
    expect(cleanQuote("was the the, uh", none)).toBe("was the, uh");
  });

  it("does not treat punctuation-only tokens as words", () => {
    expect(cleanQuote("- - go", none)).toBe("- - go");
  });

  it("does not collapse non-adjacent repeats", () => {
    expect(cleanQuote("the plan the plan", none)).toBe("the plan the plan");
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

  it("leaves a longer token that only contains the key untouched", () => {
    expect(cleanQuote("DCDCDX is here", dcd)).toBe("DCDCDX is here");
  });

  it("matches case-sensitively", () => {
    expect(cleanQuote("dcdcd is here", dcd)).toBe("dcdcd is here");
  });

  it("applies corrections after collapsing repeats", () => {
    expect(cleanQuote("DCDCD DCDCD, plan", dcd)).toBe("DCD, plan");
  });

  it("returns text unchanged when the map is empty and nothing repeats", () => {
    expect(cleanQuote("nothing to see", none)).toBe("nothing to see");
  });
});
