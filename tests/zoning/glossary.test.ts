import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { displayable, lookup, lookupIn } from "@/lib/zoning/glossary";
import { DEMO_CODES, GLOSSARY_DATA, NOT_FOUND, type GlossaryEntry } from "@/lib/zoning/glossary-data";

const FIX = join(__dirname, "../fixtures");
// Collapse whitespace. Only a hyphen at a line END is rejoined (a compound hyphen wrapped, "RS1-\nRS5");
// a mid-line "mid- to" is left alone.
const norm = (s: string) => s.replace(/-[ \t]*\n\s*/g, "-").replace(/\s+/g, " ").trim();
const rawFixture = (e: GlossaryEntry) => {
  const m = /CH295-sub(\d+)\.pdf/.exec(e.officialUrl);
  expect(m, `${e.term}: officialUrl must be a CH295-subN.pdf`).not.toBeNull();
  return readFileSync(join(FIX, "zoning-code", `CH295-sub${m![1]}.txt`), "utf8");
};
const excerptFor = (e: GlossaryEntry) => norm(rawFixture(e));
// Fixture blocks start with "# <term> (<section>)"; return the text under the heading for this entry.
const blockFor = (e: GlossaryEntry) => {
  const raw = rawFixture(e);
  const head = `# ${e.term} (${e.section})`;
  const i = raw.split("\n").findIndex((l) => l === head);
  if (i < 0) return null;
  const rest = raw.split("\n").slice(i + 1);
  const end = rest.findIndex((l) => l.startsWith("# "));
  return norm((end < 0 ? rest : rest.slice(0, end)).join("\n"));
};
const GLOSSARY = GLOSSARY_DATA;
const entries = Object.entries(GLOSSARY).map(([k, e]) => [k, e] as const);

describe("zoning glossary", () => {
  it("has the required terms", () => {
    for (const k of ["PD", "GPD", "DPD", "minor modification", "special use", "variance, dimensional", "variance, use"]) {
      expect(GLOSSARY[k], k).toBeDefined();
    }
  });

  it.each(entries)("%s: https url, section, official text present", (_k, e) => {
    expect(e.officialUrl.startsWith("https://")).toBe(true);
    expect(e.section.trim()).not.toBe("");
    expect(e.officialText.trim()).not.toBe("");
    expect(excerptFor(e)).toContain(norm(e.officialText));
  });

  it.each(entries)("%s: section heading in fixture contains the official text", (_k, e) => {
    expect(e.section).toMatch(/^295-\d+/);
    const block = blockFor(e);
    expect(block, `${e.term}: no "# ${e.term} (${e.section})" heading in fixture`).not.toBeNull();
    expect(block!).toContain(norm(e.officialText));
  });

  it.each(entries)("%s: plain draft is short, unapproved by default", (_k, e) => {
    expect(e.plain.trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(e.approved).toBe(false);
    expect(e.plain).not.toMatch(/\b(good|bad|best|worst|should|unfortunately|controversial|unfair)\b/i);
  });

  it("every code in the demo files has an entry or a NOT_FOUND reason", () => {
    const codes = new Set<string>(DEMO_CODES);
    for (const f of readdirSync(join(FIX, "mprop")).filter((f) => f.startsWith("mprop-"))) {
      const j = JSON.parse(readFileSync(join(FIX, "mprop", f), "utf8"));
      for (const r of j.result.records) if (r.ZONING) codes.add(r.ZONING);
    }
    const titles = JSON.parse(readFileSync(join(FIX, "legistar", "zoning-titles.json"), "utf8")) as { title: string }[];
    for (const { title } of titles) for (const m of title.matchAll(/, ([A-Z]{1,3}\d?[A-Z]?\d?),? /g)) codes.add(m[1]);
    for (const c of codes) {
      const covered = GLOSSARY[c] !== undefined || NOT_FOUND.some((n) => n.term === c && n.reason.length > 0);
      expect(covered, c).toBe(true);
    }
  });

  it("NOT_FOUND entries carry a reason and are not also in GLOSSARY", () => {
    for (const n of NOT_FOUND) {
      expect(n.reason.length).toBeGreaterThan(10);
      expect(GLOSSARY[n.term]).toBeUndefined();
    }
    expect(NOT_FOUND.some((n) => n.term === "conditional use")).toBe(true);
  });
});

describe("hyphen normalization", () => {
  it("does not rejoin a mid-line hyphen but rejoins a line-end one", () => {
    expect(norm("in the mid- to late-1900s")).toBe("in the mid- to late-1900s");
    expect(norm("the RS1-\nRS5 districts")).toBe("the RS1-RS5 districts");
  });
});

describe("lookup", () => {
  it("never returns an unapproved plain line", () => {
    for (const [k] of entries) {
      const r = lookup(k);
      expect(r, k).not.toBeNull();
      expect(r!.plain).toBeNull();
      expect(r!.officialText.length).toBeGreaterThan(0);
    }
  });
  it("returns the plain line when an entry is approved (wiring is not vacuous)", () => {
    const approved = Object.fromEntries(entries.map(([k, e]) => [k, { ...e, approved: true }]));
    for (const [k, e] of entries) expect(lookupIn(approved, k)!.plain).toBe(e.plain);
    expect(lookupIn({ ...approved, PD: { ...approved.PD, approved: false } }, "PD")!.plain).toBeNull();
  });
  it("returns null for unknown keys and prototype names", () => {
    expect(lookup("nope")).toBeNull();
    expect(lookup("constructor")).toBeNull();
  });
  it("undefined-suffix codes say the code does not define it", () => {
    for (const k of ["C9A(A)", "C9F(A)"]) expect(GLOSSARY[k].plain).toContain("chapter 295 does not define it");
  });
});

describe("displayable", () => {
  const base = { term: "t", plain: "A plain line.", approved: false, officialText: "x", officialUrl: "https://e.x", section: "295-1" };
  it("returns null for unapproved entries", () => expect(displayable(base)).toBeNull());
  it("returns the plain line once approved", () => expect(displayable({ ...base, approved: true })).toBe("A plain line."));
  it("returns null for a missing entry", () => expect(displayable(undefined)).toBeNull());
});
