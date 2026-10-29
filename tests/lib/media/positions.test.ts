import { describe, expect, it } from "vitest";
import { statedPosition } from "@/lib/media/positions";

const NULLS = [
  "Um all those in favor please say aye.",
  "is he in for or against it",
  "No offense against them however it does not serve current Milwaukee professionals such as myself.",
  "I'm here just to support the design team",
  "we're just here for support",
  "succinctly state your your position for against or undecided and try and add on",
  "It is certainly something we're happy to to support in whatever general way we can.",
  "as opposed to a single report listing expirations well within 15 days",
  "The plan also encourages economic sustainability by promoting high density development to support public services, citywide.",
  "you're opposed to this",
  "I'm not against housing, but…",
  "I live there I'll talk later",
  "I don't oppose this project.",
  "Do you support this project?",
  "I support the City Plan Commission.",
  "I support this project. I oppose this project.",
  "I support them.",
  "I urge you not to approve this.",
  "I no longer support this project.",
  "I wouldn't support this project.",
  "I won't oppose this.",
  "I urge you to approve the budget.",
  "I urge you to approve the other item.",
  "I urge you to ask them whether they support it.",
  "Some say I should support this project.",
  "I would support this project if they changed it.",
  "You said I support this project.",
  "He thinks we oppose this.",
  "They asked if I support this.",
  "I heard you support this project.",
  "We know you oppose this rezoning.",
  "Is it true that I support this?",
  "She said we support this project.",
  "The mayor says we oppose this rezoning.",
  "They told us we oppose this.",
  "I'm not sure I support this project.",
  "I don't know if I support this.",
  "My neighbor said he opposes this and I support this project.",
  "I told her I oppose this project.",
  "You support this and I oppose this.",
  "I urge them to approve this.",
  "He urges you and I urge you to deny this.",
];

const HITS: Array<[string, "for" | "against"]> = [
  ["I'm here in support of this project", "for"],
  ["I oppose this rezoning", "against"],
  ["I'm just totally against", "against"],
  ["I'm totally against it not that it matters I've lived here", "against"],
  ["I'm here tonight to to speak in strong support of of approving the moratorium on the data centers with no exceptions.", "for"],
  ["My city and hometown is Milwaukee and I'm here to voice my support for the data center moratorium.", "for"],
  ["So I I urge and voice my support for a yes vote and I would love to see my hometown be a leader.", "for"],
  ["I urge the city planning commission to vote in favor of this moratorium and prioritize the well-being of our community.", "for"],
  ["no no we support maybe I said it but we support this development", "for"],
  ["We urge you to deny this.", "against"],
  ["I urge the commission to vote no.", "against"],
  ["I'm for this.", "for"],
  ["I urge you to approve this item.", "for"],
  ["The developer and I support this.", "for"],
  ["I support this proposal at 123 N. Water St. and hope you do too.", "for"],
  ["I oppose this project and they support it.", "against"],
  ["We stand in opposition to the proposal.", "against"],
];

describe("statedPosition", () => {
  it.each(NULLS)("null: %s", (t) => expect(statedPosition(t)).toBeNull());

  it.each(HITS)("%s -> %s", (t, p) => expect(statedPosition(t)?.position).toBe(p));

  it("quotes only the matching sentence, verbatim and trimmed", () => {
    const r = statedPosition("Hi everyone.  I oppose this rezoning!  Thanks.");
    expect(r).toEqual({ position: "against", quote: "I oppose this rezoning!" });
  });

  it("keeps stutters in the quote", () => {
    const r = statedPosition("I I urge and voice my support for a yes vote");
    expect(r?.quote).toBe("I I urge and voice my support for a yes vote");
  });

  it("does not split on abbreviations", () => {
    const a = "I support this proposal at 123 N. Water St. and hope you do too.";
    expect(statedPosition(a)).toEqual({ position: "for", quote: a });
    const b = "Hi, I'm Ald. Smith and I support this project.";
    expect(statedPosition(b)).toEqual({ position: "for", quote: b });
  });

  it("null when sentences disagree", () => {
    expect(statedPosition("I support this project. Then I oppose this project.")).toBeNull();
  });
});
