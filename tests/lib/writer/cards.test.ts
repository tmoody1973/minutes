import { describe, expect, it } from "vitest";
import { isDraft, writeCard } from "../../../lib/writer/cards";

const sources = { "matter:74560": "File 260533 (Ordinance): A substitute ordinance relating to the change in zoning ...", "history:495640": "Sep 28, 2026: CITY PLAN COMMISSION, APPROVED CONDITIONALLY." };

describe("isDraft", () => {
  it("accepts 1 to 3 sentences, each with text and source keys", () => {
    expect(isDraft({ sentences: [{ text: "A rezoning.", sources: ["matter:74560"] }] })).toBe(true);
    expect(isDraft({ sentences: [] })).toBe(false);
    expect(isDraft({ sentences: Array(4).fill({ text: "x", sources: ["a"] }) })).toBe(false);
    expect(isDraft({ sentences: [{ text: "", sources: ["a"] }] })).toBe(false);
    expect(isDraft({ sentences: [{ text: "x", sources: "a" }] })).toBe(false);
  });
});

describe("writeCard", () => {
  it("shows the writer every record with its key and returns sentences with their keys", async () => {
    let prompt = "";
    const out = await writeCard("file", sources, async (_system, user) => {
      prompt = user;
      return { sentences: [{ text: " The City Plan Commission approved it on Sep 28. ", sources: ["history:495640"] }] };
    });
    expect(prompt).toContain("[matter:74560] File 260533");
    expect(prompt).toContain("[history:495640] Sep 28, 2026");
    expect(out).toEqual([{ text: "The City Plan Commission approved it on Sep 28.", sourceKeys: ["history:495640"] }]);
  });
});
