import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_CODES, GLOSSARY, NOT_FOUND, displayable, type GlossaryEntry } from "@/lib/zoning/glossary";

const FIX = join(__dirname, "../fixtures");
// Collapse whitespace; a hyphen at a line wrap is a compound hyphen in this code ("RS1-\nRS5"), so rejoin it.
const norm = (s: string) => s.replace(/-\s+/g, "-").replace(/\s+/g, " ").trim();
const excerptFor = (e: GlossaryEntry) => {
  const m = /CH295-sub(\d+)\.pdf/.exec(e.officialUrl);
  expect(m, `${e.term}: officialUrl must be a CH295-subN.pdf`).not.toBeNull();
  return norm(readFileSync(join(FIX, "zoning-code", `CH295-sub${m![1]}.txt`), "utf8"));
};
const entries = Object.entries(GLOSSARY);

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

describe("displayable", () => {
  const base = { term: "t", plain: "A plain line.", approved: false, officialText: "x", officialUrl: "https://e.x", section: "295-1" };
  it("returns null for unapproved entries", () => expect(displayable(base)).toBeNull());
  it("returns the plain line once approved", () => expect(displayable({ ...base, approved: true })).toBe("A plain line."));
  it("returns null for a missing entry", () => expect(displayable(undefined)).toBeNull());
});
