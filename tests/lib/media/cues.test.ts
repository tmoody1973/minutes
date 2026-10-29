import { describe, expect, it } from "vitest";
import { extractCues } from "@/lib/media/cues";
import type { Turn } from "@/lib/types";

let n = 0;
const t = (label: string | null, text: string): Turn => {
  n += 1;
  return { eventId: 1, turnKey: `0:${n}`, chunk: 0, startMs: n * 1000, endMs: n * 1000 + 900, label, text };
};
const run = (...turns: Turn[]) => extractCues(turns);

describe("extractCues: self", () => {
  it("name + affiliation after I'm with", () => {
    const a = t("c0:A", "My name is Brian Emmerich I'm with with Allegro civil engineers the consulting civil engineer on this project");
    expect(run(a)).toEqual([
      { kind: "self", name: "Brian Emmerich", affiliation: "Allegro civil engineers", turnKey: a.turnKey, targetTurnKey: a.turnKey },
    ]);
  });
  it("Name, Dept Planning", () => {
    const a = t("c0:A", "Kristen Connolly, DCDCD Planning. The subject site is within the plan development");
    const [c] = run(a);
    expect(c).toMatchObject({ kind: "self", name: "Kristen Connolly", affiliation: "DCDCD Planning", targetTurnKey: a.turnKey });
  });
  it.each([
    ["good afternoon everyone my name is David Guzman I am a resident of the 804 through 806 North Hamburg Street", "David Guzman"],
    ["Good afternoon. My name is Curtis Oquist I live at 835 North Cass Street", "Curtis Oquist"],
    ["Hello, this is Jane Roe from Habitat", "Jane Roe"],
    ["I'm Sam Lee with Zilber", "Sam Lee"],
  ])("%j", (text, name) => {
    const a = t("c0:A", text);
    expect(run(a).map((c) => [c.kind, c.name])).toEqual([["self", name]]);
  });
  it.each([
    "this is one of a series of files that at least I'm aware of",
    "I live there I'll talk later",
    "the alderman's office",
    "so my name is Brian Emmerich",
    "My name is Brian Emmerich the consulting engineer",
  ])("no cue: %j", (text) => {
    expect(run(t("c0:A", text))).toEqual([]);
  });
});

describe("extractCues: recognized", () => {
  it("would you like -> next different label", () => {
    const a = t("c0:A", "okay yep so that's a neat standard um and Alderman Bergalis would you like to add anything?");
    const same = t("c0:A", "and one more thing");
    const b = t("c0:B", "Thanks");
    expect(run(a, same, b)).toEqual([{ kind: "recognized", name: "Bergalis", turnKey: a.turnKey, targetTurnKey: b.turnKey }]);
  });
  it("the floor is yours", () => {
    const a = t("c0:A", "he gay rights and civil rights movement Alderman Bergellis the floor is yours");
    const b = t("c0:B", "thank you");
    expect(run(a, b)[0]).toMatchObject({ kind: "recognized", name: "Bergellis", targetTurnKey: b.turnKey });
  });
  it("honorific + first + surname, Ms. go ahead", () => {
    const a = t("c0:A", "Alderwoman Marina Dimitriovich you are recognized");
    const b = t("c0:B", "x");
    expect(run(a, b)[0]).toMatchObject({ name: "Marina Dimitriovich" });
    const c = t("c0:A", "Ms. Smith, go ahead");
    expect(run(c, b)[0]).toMatchObject({ name: "Smith" });
  });
  it("name alone ending the turn", () => {
    const a = t("c0:A", "Alderwoman Pratt");
    const b = t("c0:B", "here");
    expect(run(a, b)).toEqual([{ kind: "recognized", name: "Pratt", turnKey: a.turnKey, targetTurnKey: b.turnKey }]);
  });
  it("no later different-label turn -> no cue", () => {
    expect(run(t("c0:A", "Alderwoman Pratt"), t("c0:A", "more"))).toEqual([]);
    expect(run(t("c0:A", "Alderwoman Pratt"))).toEqual([]);
  });
  it.each([
    "thank you so much alderman Bergellis for this recognition to the common Common Council",
    "the record reflect we've been joined by Alderman Chambers",
    "Kaufman please come forward escorted by Alderwoman Marina Dimitriovich",
    "I talked to Alderman Smith yesterday about it",
  ])("no cue: %j", (text) => {
    expect(run(t("c0:A", text), t("c0:B", "ok"))).toEqual([]);
  });
});

it("output follows turn order", () => {
  const a = t("c0:A", "My name is Ann Lee with Foo");
  const b = t("c0:B", "Alderman Bergalis would you like to speak");
  const c = t("c0:C", "yes");
  expect(extractCues([a, b, c]).map((x) => x.kind)).toEqual(["self", "recognized"]);
});
