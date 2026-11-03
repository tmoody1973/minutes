import { describe, expect, it } from "vitest";
import { DISCLOSURE, isActive, NAV, weekOf } from "../../../lib/ui/shell";

describe("isActive", () => {
  it("home (the Ask tab) is current on / and on an answer page, nowhere else", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/ask", "/")).toBe(true);
    expect(isActive("/near", "/")).toBe(false);
  });
  it("other tabs stay current on child pages but not on look-alike paths", () => {
    expect(isActive("/meetings", "/meetings")).toBe(true);
    expect(isActive("/meetings/13559", "/meetings")).toBe(true);
    expect(isActive("/meetingsx", "/meetings")).toBe(false);
  });
  it("Ask is the one current tab on the landing page", () => {
    expect(NAV.filter((n) => isActive("/", n.href)).map((n) => n.label)).toEqual(["Ask"]);
  });
  it("exactly one tab is current on each nav page", () => {
    for (const { href } of NAV) expect(NAV.filter((n) => isActive(href, n.href))).toHaveLength(1);
  });
});

describe("weekOf (America/Chicago, weeks start Monday)", () => {
  it("a Thursday maps to that week's Monday", () => expect(weekOf(new Date("2026-10-29T17:00:00Z"))).toBe("Oct 26"));
  it("Sunday belongs to the week that started six days earlier", () => expect(weekOf(new Date("2026-11-01T18:00:00Z"))).toBe("Oct 26"));
  it("uses Milwaukee time: 1 AM UTC Tuesday is still Monday evening in Chicago", () =>
    expect(weekOf(new Date("2026-11-03T01:00:00Z"))).toBe("Nov 2"));
  it("Sunday night in Chicago is already Monday in UTC but still the old week", () =>
    expect(weekOf(new Date("2026-11-02T04:30:00Z"))).toBe("Oct 26"));
  it("crosses a month boundary", () => expect(weekOf(new Date("2026-12-02T18:00:00Z"))).toBe("Nov 30"));
});

it("disclosure matches the spec line verbatim", () => {
  expect(DISCLOSURE).toBe("Built by Tarik Moody, a sitting member of the City Plan Commission. Public records only, no recommendations.");
});
