import { describe, expect, it } from "vitest";
import { ACTION_TERMS, termsIn, termsInFrom } from "../../../lib/legistar/terms";

const approvedAll = ACTION_TERMS.map((t) => ({ ...t, approved: true }));

describe("termsIn", () => {
  it("finds each term an answer uses, once, in list order, by any of its spellings", () => {
    const text = ["It was held to call of the chair.", "Two were placed on file; one was Placed On File again.", "It was sent on without a recommendation."];
    expect(termsInFrom(approvedAll, text).map((t) => t.term)).toEqual(["Held to call of the chair", "Placed on file", "Referred without recommendation"]);
  });
  it("shows nothing that isn't approved", () => {
    expect(termsInFrom(ACTION_TERMS.map((t) => ({ ...t, approved: false })), ["It was placed on file."])).toEqual([]);
  });
  it("the live list only returns approved entries", () =>
    expect(termsIn(["held to call of the chair, placed on file, recommended for passage"]).every((t) => ACTION_TERMS.find((x) => x.term === t.term)?.approved)).toBe(true));
});
