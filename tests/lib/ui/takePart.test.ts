import { describe, expect, it } from "vitest";
import { ALDERS, alderContact, beHeard, BE_HEARD, COUNCIL_COMMITTEES } from "../../../lib/ui/takePart";

const approve = <T extends { approved: boolean }>(x: T) => ({ ...x, approved: true });

describe("how to be heard", () => {
  it("shows a body's own instructions only once approved", () => {
    const entries = BE_HEARD.map(approve);
    expect(beHeard("Fire and Police Commission", entries, COUNCIL_COMMITTEES)?.lines[0]).toMatch(/public comment item/);
    expect(beHeard("Fire and Police Commission", BE_HEARD.map((e) => ({ ...e, approved: false })), { ...COUNCIL_COMMITTEES, approved: false })).toBeNull();
  });
  it("a Council committee with no published procedure gets the Council's own general statement, once approved", () => {
    const fallback = approve(COUNCIL_COMMITTEES);
    expect(beHeard("Licenses Committee", [], fallback)).toBe(fallback);
    expect(beHeard("Historic Preservation Commission", [], fallback)).toBeNull(); // not a Council committee
  });
  it("every entry names an official city source", () =>
    expect([...BE_HEARD, COUNCIL_COMMITTEES].every((e) => /^https:\/\/(city\.milwaukee\.gov|milwaukee\.legistar1?\.com)\//.test(e.url))).toBe(true));
});

describe("alder contacts", () => {
  it("all 15 districts, each with an official page and a city email", () => {
    expect(Object.keys(ALDERS).map(Number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(Object.values(ALDERS).every((a) => a.page.startsWith("https://city.milwaukee.gov/commoncouncil/") && a.email.endsWith("@milwaukee.gov"))).toBe(true);
  });
  it("hidden until approved", () => {
    expect(alderContact(4, {})).toBeNull();
    expect(alderContact(4, { 4: true })?.email).toBe("rjbauma@milwaukee.gov");
  });
});
