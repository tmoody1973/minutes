import { describe, expect, it } from "vitest";
import { expandAddress, snippet } from "../../../lib/search/query";

describe("expandAddress", () => {
  it("spells out the abbreviations residents type, the way Legistar titles write them", () => {
    expect(expandAddress("711 E Kilbourn Ave")).toBe("711 East Kilbourn Avenue");
    expect(expandAddress("822 N. Van Buren St.")).toBe("822 North Van Buren Street");
    expect(expandAddress("w good hope rd")).toBe("West good hope Road");
  });
  it("leaves ordinary words alone", () => expect(expandAddress("parking lot sale")).toBe("parking lot sale"));
});

describe("snippet", () => {
  const text = "Good evening. ".repeat(20) + "I live on Van Buren and I oppose the height of this building. " + "Thank you. ".repeat(20);
  it("centers on the first matching word and marks cuts", () => {
    const s = snippet(text, "oppose height");
    expect(s).toContain("I oppose the height");
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThanOrEqual(222);
  });
  it("short text comes back whole", () => expect(snippet("I support it.", "support")).toBe("I support it."));
});
