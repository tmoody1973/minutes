import { describe, expect, it } from "vitest";
import { toPassages } from "../../../lib/docs/passages";

describe("toPassages", () => {
  it("joins a PDF's broken lines into paragraphs and packs them into short passages", () => {
    const text = "FISCAL NOTE\n\nThe contract with the\nvendor costs $1,200,000\nover three years.\n\n\fSecond page paragraph about\nlicense plate readers.";
    expect(toPassages(text, 80)).toEqual([
      "FISCAL NOTE The contract with the vendor costs $1,200,000 over three years.",
      "Second page paragraph about license plate readers.",
    ]);
  });
  it("cuts a paragraph longer than a passage at word boundaries, and stops at the cap", () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const out = toPassages(words, 50, 3);
    expect(out).toHaveLength(3);
    expect(out.every((p) => p.length <= 50 && !/^\s|\s$/.test(p))).toBe(true);
    expect(out[0].startsWith("word0 word1")).toBe(true);
  });
  it("a scanned PDF with no text has no passages", () => expect(toPassages(" \f \n\n ")).toEqual([]));
});
