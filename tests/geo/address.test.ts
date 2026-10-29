import { describe, expect, it } from "vitest";
import { extractAddresses } from "@/lib/geo/address";

import titles from "../fixtures/legistar/zoning-titles.json";

const t = (file: string) => titles.find((x) => x.file === file)!.title;
const SOUTHGATE = t("260532");
const BOOKENDS = t("260533");
const KANE = t("260047");
const EVERETT = t("252190");
const BADER = t("252189");
const TEXT = t("260642");

describe("extractAddresses", () => {
  it("Southgate: ignores location phrases", () => {
    expect(extractAddresses(SOUTHGATE)).toEqual([{ houseNumber: 3473, dir: "S", street: "27TH", type: "ST" }]);
  });
  it("Bookends: two addresses in order", () => {
    expect(extractAddresses(BOOKENDS)).toEqual([
      { houseNumber: 711, dir: "E", street: "KILBOURN", type: "AV" },
      { houseNumber: 822, dir: "N", street: "VAN BUREN", type: "ST" },
    ]);
  });
  it("expands short range suffix", () => {
    expect(extractAddresses(KANE)).toEqual([{ houseNumber: 1162, houseNumberHigh: 1164, dir: "E", street: "KANE", type: "PL" }]);
  });
  it("Everett", () => {
    expect(extractAddresses(EVERETT)).toEqual([{ houseNumber: 234, dir: "S", street: "WATER", type: "ST" }]);
  });
  it("Bader: list shares the street; MPROP spelling", () => {
    expect(extractAddresses(BADER)).toEqual([
      { houseNumber: 410, dir: "W", street: "CONCORDIA", type: "AV" },
      { houseNumber: 3301, dir: "N", street: "VEL R PHILLIPS", type: "AV" },
      { houseNumber: 3307, dir: "N", street: "VEL R PHILLIPS", type: "AV" },
    ]);
  });
  it("no addresses in text ordinance", () => {
    expect(extractAddresses(TEXT)).toEqual([]);
  });
  it("de-duplicates", () => {
    expect(extractAddresses("at 711 East Kilbourn Avenue and again 711 East Kilbourn Avenue")).toHaveLength(1);
  });
  it("unknown street type omits type but keeps address", () => {
    expect(extractAddresses("at 100 North Foo Circle, in the")).toEqual([{ houseNumber: 100, dir: "N", street: "FOO" }]);
  });
  it("full range with long high number", () => {
    expect(extractAddresses("at 1162-1164 East Kane Place")[0]).toMatchObject({ houseNumber: 1162, houseNumberHigh: 1164 });
  });
  it("ordinal and building counts are not house numbers", () => {
    expect(extractAddresses("in the 4th Aldermanic District; 5th Amendment; Phase 1")).toEqual([]);
  });
  it("strips apostrophes and collapses whitespace", () => {
    expect(extractAddresses("at 100 North O'Brien Street")[0].street).toBe("OBRIEN");
    expect(extractAddresses("at 100 North Foo\n  Bar Street")[0].street).toBe("FOO BAR");
  });
  it("allows lowercase connectors", () => {
    expect(extractAddresses("at 2000 North Fond du Lac Avenue")).toEqual([{ houseNumber: 2000, dir: "N", street: "FOND DU LAC", type: "AV" }]);
  });
  it("requires the direction word", () => {
    expect(extractAddresses("at 2000 Fond du Lac Avenue")).toEqual([]);
  });
  it("range rollover", () => {
    expect(extractAddresses("at 1199-02 North Water Street")[0]).toMatchObject({ houseNumber: 1199, houseNumberHigh: 1202 });
  });
  it("numbers after Phase/Unit/No./Lot are not house numbers", () => {
    expect(extractAddresses("Phase 1 North Plaza Court")).toEqual([]);
    expect(extractAddresses("Unit 5 North Plaza Court")).toEqual([]);
  });
  it("skips context sites introduced by 'includes'", () => {
    expect(extractAddresses(BADER).some((a) => a.houseNumber === 3300)).toBe(false);
    expect(extractAddresses("the DPD that includes 100 North Foo Street")).toEqual([]);
    expect(extractAddresses("the DPD which currently includes 100 North Foo Street")).toEqual([]);
  });
  it("skips the whole address list after 'includes'", () => {
    expect(extractAddresses("which includes 100 and 102 North Foo Street")).toEqual([]);
    expect(extractAddresses("that currently includes 3300 and 3302 North Martin Luther King Jr. Drive")).toEqual([]);
  });
  it("still extracts a later real address in a new clause", () => {
    expect(extractAddresses("that includes 100 North Foo Street, and a new building at 200 West Bar Street")).toEqual([
      { houseNumber: 200, dir: "W", street: "BAR", type: "ST" },
    ]);
  });
  it("guard words are case-insensitive", () => {
    expect(extractAddresses("PHASE 1 North Plaza Court")).toEqual([]);
    expect(extractAddresses("LOT 7 North Plaza Court")).toEqual([]);
  });
});
