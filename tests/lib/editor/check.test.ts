import { describe, expect, it } from "vitest";
import { editorCheck } from "../../../lib/editor/check";
import { evaluativeWord } from "../../../lib/editor/rules";

const HISTORY = "history:495640";
const sources = new Map([[HISTORY, "Sep 28, 2026: CITY PLAN COMMISSION, APPROVED CONDITIONALLY. Vote: 5 aye, 0 no, 2 excused."]]);
// The model is never called for the first three verdicts; a call would fail the test.
const noModel = async () => {
  throw new Error("model must not be called");
};

describe("editorCheck", () => {
  it("rejects a sentence with no source", async () => {
    expect(await editorCheck({ text: "The commission approved it.", sourceKeys: [] }, sources, noModel)).toMatchObject({ ok: false, reason: "no-source" });
  });
  it("rejects a source key it was not given", async () => {
    expect(await editorCheck({ text: "The commission approved it.", sourceKeys: ["history:1"] }, sources, noModel)).toMatchObject({
      ok: false,
      reason: "unknown-source",
    });
  });
  it("rejects evaluative wording even with a valid source", async () => {
    const v = await editorCheck({ text: "The project is a welcome improvement for the corridor.", sourceKeys: [HISTORY] }, sources, noModel);
    expect(v).toMatchObject({ ok: false, reason: "evaluative", detail: "welcome" });
  });
  it("passes a sentence its source states", async () => {
    const seen: string[][] = [];
    const v = await editorCheck(
      { text: "The City Plan Commission approved file 260533 conditionally on Sep 28.", sourceKeys: [HISTORY] },
      sources,
      async (_text, srcs) => (seen.push(srcs), { supported: true, reason: "stated" }),
    );
    expect(v).toEqual({ ok: true });
    // The verifier sees only this sentence's sources, never the drafting.
    expect(seen).toEqual([[sources.get(HISTORY)]]);
  });
  it("rejects a sentence the model says its sources don't support", async () => {
    const v = await editorCheck({ text: "The commission approved it 9 to 0.", sourceKeys: [HISTORY] }, sources, async () => ({
      supported: false,
      reason: "The source records 5 aye, 0 no, 2 excused.",
    }));
    expect(v).toEqual({ ok: false, reason: "unsupported", detail: "The source records 5 aye, 0 no, 2 excused." });
  });
});

describe("evaluativeWord", () => {
  it("matches whole words only, any case", () => {
    expect(evaluativeWord("Finally, the Council voted.")).toBe("finally");
    expect(evaluativeWord("The goods were sold at the hearing.")).toBeNull();
    expect(evaluativeWord("Residents spoke for and against.")).toBeNull();
    expect(evaluativeWord("A much-needed building.")).toBe("much-needed");
  });
  it("treats official names that contain a listed word as names", () => {
    expect(evaluativeWord("It would fill a seat on Business Improvement District #11.")).toBeNull();
    expect(evaluativeWord("Plans for neighborhood improvement districts.")).toBeNull();
    expect(evaluativeWord("It would approve public improvement work.")).toBeNull();
    expect(evaluativeWord("A welcome improvement for the corridor.")).toBe("welcome");
    expect(evaluativeWord("It is an improvement.")).toBe("improvement");
    expect(evaluativeWord("A lot on W. Good Hope Rd. near the Great Lakes.")).toBeNull();
  });
});
