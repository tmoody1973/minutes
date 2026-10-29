import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignFromCues,
  confirmAssignments,
  matchRoster,
  nameSpeakers,
  normalizeName,
  validateAssignment,
  type RosterEntry,
} from "@/lib/media/speakers";
import type { Cue, SpeakerAssignment, Turn } from "@/lib/types";

let n = 0;
beforeEach(() => {
  n = 0;
});
const t = (label: string | null, text = "words"): Turn => {
  n += 1;
  return { eventId: 1, turnKey: `0:${n}`, chunk: 0, startMs: n * 1000, endMs: n * 1000 + 900, label, text };
};
const cue = (kind: Cue["kind"], name: string, from: Turn, target: Turn): Cue => ({ kind, name, turnKey: from.turnKey, targetTurnKey: target.turnKey });

const roster: RosterEntry[] = [
  { personId: 1, name: "ALD. R. BAUMAN" },
  { personId: 2, name: "ALD. S. BURGELIS" },
  { personId: 3, name: "ALD. A. PRATT" },
  { personId: 4, name: "Tarik Moody" },
];

describe("normalizeName", () => {
  it("strips honorifics and splits initials", () => {
    expect(normalizeName("ALD. A. PRATT")).toEqual({ initial: "a", surname: "pratt" });
    expect(normalizeName("Commissioner Commissioner Tariq Moody")).toEqual({ first: "tariq", initial: "t", surname: "moody" });
    expect(normalizeName("Alderman Pratt")).toEqual({ surname: "pratt" });
    expect(normalizeName("Dr. Jane Q. Public").surname).toBe("public");
  });
});

describe("matchRoster", () => {
  it("matches a misspelled surname within edit distance 2", () => {
    expect(matchRoster("Bergalis", roster)?.personId).toBe(2);
  });
  it("uses distance 1 for short surnames", () => {
    expect(matchRoster("Pratz", roster)?.personId).toBe(3);
    expect(matchRoster("Prxxt", roster)).toBeNull();
  });
  it("requires the roster initial to agree with a heard first name", () => {
    expect(matchRoster("Zed Pratt", roster)).toBeNull();
    expect(matchRoster("Andrea Pratt", roster)?.personId).toBe(3);
  });
  it("compares a heard initial to the roster initial", () => {
    expect(matchRoster("B. Pratt", [{ personId: 3, name: "ALD. A. PRATT" }])).toBeNull();
    expect(matchRoster("A. Pratt", [{ personId: 3, name: "ALD. A. PRATT" }])?.personId).toBe(3);
  });
  it("ignores name suffixes when choosing the surname", () => {
    expect(matchRoster("Pratt", [{ personId: 5, name: "Andrew Pratt Jr." }])?.personId).toBe(5);
  });
  it("returns null when two roster entries match", () => {
    const amb = [...roster, { personId: 9, name: "ALD. B. PRATT" }];
    expect(matchRoster("Pratt", amb)).toBeNull();
    expect(matchRoster("Bob Pratt", amb)?.personId).toBe(9);
  });
  it("returns null for unknown names", () => {
    expect(matchRoster("Emmerich", roster)).toBeNull();
  });
});

describe("assignFromCues", () => {
  it("roster match -> legistar with roster display name", () => {
    const a = t("c0:A", "Alderman Bergalis.");
    const b = t("c0:B");
    const out = assignFromCues([a, b], [cue("recognized", "Bergalis", a, b)], roster);
    expect(out).toEqual([{ label: "c0:B", name: "Ald. S. Burgelis", personId: 2, source: "legistar", evidenceTurnKey: a.turnKey }]);
  });
  it("Tariq Moody roll call -> roster spelling, no special case", () => {
    const a = t("c0:A");
    const b = t("c0:B");
    const out = assignFromCues([a, b], [cue("recognized", "Tariq Moody", a, b)], roster);
    expect(out[0]).toMatchObject({ source: "legistar", name: "Tarik Moody", personId: 4 });
  });
  it("ambiguous surname -> no assignment", () => {
    const a = t("c0:A");
    const b = t("c0:B");
    const amb = [...roster, { personId: 9, name: "ALD. B. PRATT" }];
    expect(assignFromCues([a, b], [cue("recognized", "Pratt", a, b)], amb)).toEqual([]);
  });
  it("self cue without roster match -> self-intro as heard", () => {
    const a = t("c0:A", "My name is Brian Emmerich");
    const out = assignFromCues([a], [cue("self", "Brian Emmerich", a, a)], roster);
    expect(out).toEqual([{ label: "c0:A", name: "Brian Emmerich", source: "self-intro", evidenceTurnKey: a.turnKey }]);
  });
  it("recognized cue with no roster match -> nothing", () => {
    const a = t("c0:A");
    const b = t("c0:B");
    expect(assignFromCues([a, b], [cue("recognized", "Emmerich", a, b)], roster)).toEqual([]);
  });
  it("conflict on one label drops both; identical names keep one", () => {
    const a = t("c0:A");
    const b = t("c0:B");
    const c = t("c0:C");
    const conflict = assignFromCues([a, b, c], [cue("recognized", "Pratt", a, c), cue("recognized", "Bauman", b, c)], roster);
    expect(conflict).toEqual([]);
    const same = assignFromCues([a, b, c], [cue("recognized", "Pratt", a, c), cue("recognized", "Pratz", b, c)], roster);
    expect(same).toHaveLength(1);
    expect(same[0].evidenceTurnKey).toBe(a.turnKey);
  });
  it("Ruling 16: self cue takes a roster identity only if first name/initial agree", () => {
    const a = t("c0:A");
    const run = (name: string, r: RosterEntry[]) => assignFromCues([a], [cue("self", name, a, a)], r);
    expect(run("Sam Burgelis", roster)[0]).toMatchObject({ source: "legistar", personId: 2 });
    expect(run("Tom Burgess", roster)[0]).toMatchObject({ source: "self-intro", name: "Tom Burgess" });
    expect(run("Sam Burgess", [{ personId: 8, name: "Scott Burgelis" }])[0]).toMatchObject({ source: "self-intro", name: "Sam Burgess" });
    expect(run("Scot Burgelis", [{ personId: 8, name: "Scott Burgelis" }])[0]).toMatchObject({ source: "legistar", personId: 8 });
  });
  it("self-intro roster upgrade needs an exact surname (no edit distance)", () => {
    const a = t("c0:A");
    const r = [{ personId: 9, name: "JOHN SMITH" }];
    expect(assignFromCues([a], [cue("self", "Jon Smyth", a, a)], r)[0]).toMatchObject({ source: "self-intro", name: "Jon Smyth" });
    expect(assignFromCues([a], [cue("self", "Sam Burgess", a, a)], roster)[0]).toMatchObject({ source: "self-intro" });
    // recognized cues keep Ruling 10 tolerance
    expect(assignFromCues([a, t("c0:B")], [cue("recognized", "Smyth", a, a)], r)[0]).toMatchObject({ source: "legistar", personId: 9 });
  });
  it("skips cues whose target is missing or unlabeled", () => {
    const a = t("c0:A");
    const nul = t(null);
    expect(assignFromCues([a, nul], [cue("self", "Brian Emmerich", a, nul), { ...cue("self", "X Y", a, a), targetTurnKey: "9:9" }], roster)).toEqual([]);
  });
});

describe("validateAssignment", () => {
  it("rejects an assignment with no supporting cue", () => {
    const a = t("c0:A");
    const fake: SpeakerAssignment = { label: "c0:A", name: "Brian Emmerich", source: "self-intro", evidenceTurnKey: a.turnKey };
    expect(validateAssignment(fake, [a], [], roster)).toBe(false);
  });
  it("accepts one that traces to a cue, rejects a renamed one, accepts manual", () => {
    const a = t("c0:A");
    const b = t("c0:B");
    const cues = [cue("recognized", "Bergalis", a, b)];
    const [good] = assignFromCues([a, b], cues, roster);
    expect(validateAssignment(good, [a, b], cues, roster)).toBe(true);
    expect(validateAssignment({ ...good, name: "Ald. R. Bauman" }, [a, b], cues, roster)).toBe(false);
    expect(validateAssignment({ ...good, label: "c0:A" }, [a, b], cues, roster)).toBe(false);
    expect(validateAssignment({ label: "c0:Z", name: "Anyone", source: "manual", evidenceTurnKey: "" }, [a, b], cues, roster)).toBe(true);
  });
});

describe("validateAssignment (self-contained)", () => {
  it("conflicting cues on a label make both invalid; wrong evidence key is invalid", () => {
    const a = t("c0:A");
    const b = t("c0:B");
    const c = t("c0:C");
    const cues = [cue("recognized", "Pratt", a, c), cue("recognized", "Bauman", b, c)];
    const mk = (name: string, personId: number, ev: Turn): SpeakerAssignment => ({ label: "c0:C", name, personId, source: "legistar", evidenceTurnKey: ev.turnKey });
    expect(validateAssignment(mk("Ald. A. Pratt", 3, a), [a, b, c], cues, roster)).toBe(false);
    expect(validateAssignment(mk("Ald. R. Bauman", 1, b), [a, b, c], cues, roster)).toBe(false);
    const ok = [cue("recognized", "Pratt", a, c)];
    expect(validateAssignment(mk("Ald. A. Pratt", 3, a), [a, b, c], ok, roster)).toBe(true);
    expect(validateAssignment(mk("Ald. A. Pratt", 3, b), [a, b, c], ok, roster)).toBe(false);
  });
});

describe("nameSpeakers", () => {
  it("re-letters unnamed labels in order and never merges across chunks", () => {
    const x = { ...t("c0:B"), chunk: 0 };
    const y = { ...t("c1:A"), chunk: 1 };
    const z = t("c0:B");
    const u = t(null);
    const out = nameSpeakers([x, y, z, u], []);
    expect(out.map((o) => o.display)).toEqual(["Speaker A", "Speaker B", "Speaker A", "Unidentified speaker"]);
    expect(out.every((o) => !o.asHeard)).toBe(true);
  });
  it("shows names, asHeard only for self-intro, and shares display only for same name", () => {
    const a = t("c0:A");
    const b = t("c1:A");
    const c = t("c2:A");
    const accepted: SpeakerAssignment[] = [
      { label: "c0:A", name: "Brian Emmerich", source: "self-intro", evidenceTurnKey: "x" },
      { label: "c1:A", name: "Ald. A. Pratt", personId: 3, source: "legistar", evidenceTurnKey: "x" },
    ];
    const out = nameSpeakers([a, b, c], accepted);
    expect(out).toEqual([
      { turnKey: a.turnKey, display: "Brian Emmerich", asHeard: true },
      { turnKey: b.turnKey, display: "Ald. A. Pratt", asHeard: false },
      { turnKey: c.turnKey, display: "Speaker A", asHeard: false },
    ]);
  });
  it("two chunk labels with the same name share a display", () => {
    const a = t("c0:A");
    const b = t("c1:C");
    const acc = (label: string): SpeakerAssignment => ({ label, name: "Ald. A. Pratt", personId: 3, source: "legistar", evidenceTurnKey: "x" });
    expect(nameSpeakers([a, b], [acc("c0:A"), acc("c1:C")]).map((o) => o.display)).toEqual(["Ald. A. Pratt", "Ald. A. Pratt"]);
  });
  it("conflicting automatic names leave the label unnamed; latest manual wins", () => {
    const a = t("c0:A");
    const b = t("c0:B");
    const auto = (name: string): SpeakerAssignment => ({ label: "c0:A", name, source: "self-intro", evidenceTurnKey: "x" });
    expect(nameSpeakers([a], [auto("Brian Emmerich"), auto("Curtis Oquist")])[0].display).toBe("Speaker A");
    const man = (name: string, at: number): SpeakerAssignment => ({ label: "c0:B", name, source: "manual", evidenceTurnKey: "", at, by: "tarik" });
    expect(nameSpeakers([b], [man("New", 20), man("Old", 10)])[0].display).toBe("New");
    expect(nameSpeakers([b], [man("Old", 10), man("New", 20)])[0].display).toBe("New");
  });
  it("manual overrides automatic for its label", () => {
    const a = t("c0:A");
    const accepted: SpeakerAssignment[] = [
      { label: "c0:A", name: "Brian Emmerich", source: "self-intro", evidenceTurnKey: "x" },
      { label: "c0:A", name: "Real Name", source: "manual", evidenceTurnKey: "" },
    ];
    expect(nameSpeakers([a], accepted)[0]).toEqual({ turnKey: a.turnKey, display: "Real Name", asHeard: false });
  });
});

describe("nameSpeakers hidden labels", () => {
  it("a hidden label shows as a Speaker letter even with an automatic assignment", () => {
    const a = t("c0:E");
    const b = t("c0:F");
    const acc: SpeakerAssignment[] = [{ label: "c0:E", name: "Willie Smith", source: "legistar", evidenceTurnKey: a.turnKey }];
    expect(nameSpeakers([a, b], acc, ["c0:E"]).map((o) => o.display)).toEqual(["Speaker A", "Speaker B"]);
    expect(nameSpeakers([a, b], acc)[0].display).toBe("Willie Smith");
  });
});

describe("confirmAssignments", () => {
  it("shows the model EVERY turn of the label (mixed-speaker case) and honors a reject", async () => {
    const roll = t("c0:A", "Commissioner Smith.");
    const present = t("c0:E", "Present.");
    const mid = t("c0:A", "Next item.");
    const aye = t("c0:E", "Aye");
    const rep = t("c0:E", "Kristen Connolly, DCD Planning, " + "we do recommend approval of the file. ".repeat(30) + "END_OF_REPORT");
    const turns = [roll, present, mid, aye, t("c0:A", "a"), t("c0:A", "b"), t("c0:A", "c"), t("c0:A", "d"), rep];
    const cand: SpeakerAssignment = { label: "c0:E", name: "Willie Smith", source: "legistar", evidenceTurnKey: roll.turnKey };
    const spark = vi.fn(async () => ({ confirm: false, reason: "label also carries a DCD staff presentation" }));
    const r = await confirmAssignments([cand], turns, [cue("recognized", "Smith", roll, present)], spark as never);
    const user = (spark.mock.calls[0] as unknown as string[])[1];
    expect(user).toContain("Present.");
    expect(user).toContain("Aye");
    expect(user).toContain("Kristen Connolly, DCD Planning");
    expect(user).toContain(`${rep.turnKey} `);
    expect(user).not.toContain("END_OF_REPORT"); // clipped to ~400 chars
    expect(user).toMatch(/all of (these|those) turns/i);
    expect(user.indexOf("<transcript>")).toBeLessThan(user.indexOf("Kristen Connolly"));
    expect(user.indexOf("Kristen Connolly")).toBeLessThan(user.indexOf("</transcript>"));
    expect(r.accepted).toEqual([]);
    expect(r.rejected[0].reason).toMatch(/staff/);
  });
  it("caps the label block at about 20k chars", async () => {
    const turns = [t("c0:A", "Commissioner Smith."), ...Array.from({ length: 200 }, () => t("c0:E", "x".repeat(390)))];
    const cand: SpeakerAssignment = { label: "c0:E", name: "Willie Smith", source: "legistar", evidenceTurnKey: turns[0].turnKey };
    const spark = vi.fn(async () => ({ confirm: false, reason: "r" }));
    await confirmAssignments([cand], turns, [cue("recognized", "Smith", turns[0], turns[1])], spark as never);
    expect((spark.mock.calls[0] as unknown as string[])[1].length).toBeLessThan(24_000);
  });
  const setup = () => {
    const turns = [t("c0:A", "Alderman Pratt."), t("c0:B", "Thank you chair."), t("c0:A", "Go on")];
    const cand: SpeakerAssignment = { label: "c0:B", name: "Ald. A. Pratt", personId: 3, source: "legistar", evidenceTurnKey: turns[0].turnKey };
    const cues = [cue("recognized", "Pratt", turns[0], turns[1])];
    return { turns, cand, cues };
  };
  it("confirm keeps the candidate unchanged even if the model returns a different name", async () => {
    const { turns, cand, cues } = setup();
    const spark = vi.fn(async () => ({ confirm: true, reason: "hand-off", name: "Someone Else" })) as never;
    const r = await confirmAssignments([cand], turns, cues, spark);
    expect(r.accepted).toEqual([cand]);
    expect(r.rejected).toEqual([]);
  });
  it("sends context with labels and text, and the candidate name", async () => {
    const { turns, cand, cues } = setup();
    const spark = vi.fn(async () => ({ confirm: true, reason: "ok" }));
    await confirmAssignments([cand], turns, cues, spark as never);
    const [system, user] = spark.mock.calls[0] as unknown as string[];
    expect(system).toMatch(/doubt/i);
    expect(user).toContain("Ald. A. Pratt");
    expect(user).toContain("c0:B");
    expect(user).toContain("Thank you chair.");
    expect(user).toContain('Spoken name in the cue: "Pratt"');
    expect(user).toMatch(/CUE\s+\[c0:A\]/);
    expect(user).toMatch(/TARGET\s+\[c0:B\]/);
    expect(user).toContain("<transcript>");
    expect(system).toMatch(/untrusted/i);
  });
  it("missing context rejects without calling the model", async () => {
    const { turns, cand } = setup();
    const spark = vi.fn();
    const r = await confirmAssignments([cand], turns, [], spark as never);
    expect(spark).not.toHaveBeenCalled();
    expect(r.rejected).toEqual([{ a: cand, reason: "context not found" }]);
  });
  it("reject drops with the reason", async () => {
    const { turns, cand, cues } = setup();
    const spark = vi.fn(async () => ({ confirm: false, reason: "only mentioned" }));
    const r = await confirmAssignments([cand], turns, cues, spark as never);
    expect(r.accepted).toEqual([]);
    expect(r.rejected).toEqual([{ a: cand, reason: "only mentioned" }]);
  });
  it("spark failure -> rejected as model unavailable", async () => {
    const { turns, cand, cues } = setup();
    const spark = vi.fn(async () => {
      throw new Error("boom");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await confirmAssignments([cand], turns, cues, spark as never);
    expect(r.rejected).toEqual([{ a: cand, reason: "model unavailable" }]);
  });
});
