import { describe, expect, it } from "vitest";
import { extractAddresses } from "@/lib/geo/address";

const SOUTHGATE = "A substitute ordinance relating to the 5th Amendment to the Detailed Planned Development known as Southgate Marketplace, Phase 1 to allow the construction of a bank with drive-through ATM at 3473 South 27th Street, on the west side of South 27th Street, north of West Morgan Avenue, in the 11th Aldermanic District.";
const BOOKENDS = "A substitute ordinance relating to the change in zoning from General Planned Development known as Bookends to a Detailed Planned Development known as Zenith to allow the construction of a multi-family residential building at 711 East Kilbourn Avenue and 822 North Van Buren Street, on the east side of North Van Buren Street, south of East Kilbourn Avenue, in the 4th Aldermanic District.";
const KANE = "Substitute resolution relating to a Minor Modification to the Detailed Planned Development known as Kane Commons, Phase 1 to allow exterior alterations to the existing residential structure at 1162-64 East Kane Place, located on the north side of East Kane Place, east of North Humboldt Avenue, in the 3rd Aldermanic District.";
const EVERETT = "A substitute ordinance relating to the change in zoning from General Planned Development to a new Detailed Planned Development known as The Everett Multifamily to allow a multi-family residential development on the property located at 234 South Water Street, on the east side of South Water Street, south of East Pittsburgh Avenue";
const BADER = "A substitute ordinance relating to the change in zoning from Two-Family Residential, RT4, and Local Business, LB2, for the properties located at 410 West Concordia Avenue and 3301 and 3307 North Vel R. Phillips Avenue to Detailed Planned Development, DPD, and the 1st Amendment to the DPD known as Bader Philanthropies";
const TEXT = "A substitute ordinance relating to zoning regulations for family day care homes.";

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
  it("Bader: list shares the street; keeps punctuation in names", () => {
    expect(extractAddresses(BADER)).toEqual([
      { houseNumber: 410, dir: "W", street: "CONCORDIA", type: "AV" },
      { houseNumber: 3301, dir: "N", street: "VEL R. PHILLIPS", type: "AV" },
      { houseNumber: 3307, dir: "N", street: "VEL R. PHILLIPS", type: "AV" },
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
});
