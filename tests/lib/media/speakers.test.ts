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
  it("manual overrides automatic for its label", () => {
    const a = t("c0:A");
    const accepted: SpeakerAssignment[] = [
      { label: "c0:A", name: "Brian Emmerich", source: "self-intro", evidenceTurnKey: "x" },
      { label: "c0:A", name: "Real Name", source: "manual", evidenceTurnKey: "" },
    ];
    expect(nameSpeakers([a], accepted)[0]).toEqual({ turnKey: a.turnKey, display: "Real Name", asHeard: false });
  });
});

describe("confirmAssignments", () => {
  const setup = () => {
    const turns = [t("c0:A", "Alderman Pratt."), t("c0:B", "Thank you chair."), t("c0:A", "Go on")];
    const cand: SpeakerAssignment = { label: "c0:B", name: "Ald. A. Pratt", personId: 3, source: "legistar", evidenceTurnKey: turns[0].turnKey };
    return { turns, cand };
  };
  it("confirm keeps the candidate unchanged even if the model returns a different name", async () => {
    const { turns, cand } = setup();
    const spark = vi.fn(async () => ({ confirm: true, reason: "hand-off", name: "Someone Else" })) as never;
    const r = await confirmAssignments([cand], turns, spark);
    expect(r.accepted).toEqual([cand]);
    expect(r.rejected).toEqual([]);
  });
  it("sends context with labels and text, and the candidate name", async () => {
    const { turns, cand } = setup();
    const spark = vi.fn(async () => ({ confirm: true, reason: "ok" }));
    await confirmAssignments([cand], turns, spark as never);
    const [system, user] = spark.mock.calls[0] as unknown as string[];
    expect(system).toMatch(/doubt/i);
    expect(user).toContain("Ald. A. Pratt");
    expect(user).toContain("c0:B");
    expect(user).toContain("Thank you chair.");
  });
  it("reject drops with the reason", async () => {
    const { turns, cand } = setup();
    const spark = vi.fn(async () => ({ confirm: false, reason: "only mentioned" }));
    const r = await confirmAssignments([cand], turns, spark as never);
    expect(r.accepted).toEqual([]);
    expect(r.rejected).toEqual([{ a: cand, reason: "only mentioned" }]);
  });
  it("spark failure -> rejected as model unavailable", async () => {
    const { turns, cand } = setup();
    const spark = vi.fn(async () => {
      throw new Error("boom");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await confirmAssignments([cand], turns, spark as never);
    expect(r.rejected).toEqual([{ a: cand, reason: "model unavailable" }]);
  });
});
