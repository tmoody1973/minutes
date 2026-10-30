import { describe, expect, it } from "vitest";
import { bodyLabel, emptyMessage, hearingLabel, kindLabel, parseSavedPlace, placeHeading, shortAddress, chipText, distanceLabel } from "../../../lib/ui/near";

const BOOKENDS =
  "A substitute ordinance relating to the change in zoning from General Planned Development known as Bookends to a Detailed Planned Development known as Zenith to allow the construction of a multi-family residential building at 711 East Kilbourn Avenue and 822 North Van Buren Street, on the east side of North Van Buren Street, south of East Kilbourn Avenue, in the 4th Aldermanic District.";

describe("placeHeading", () => {
  it("formats city-record addresses for reading", () =>
    expect(placeHeading(BOOKENDS, "260533")).toBe("711 E. Kilbourn Ave. and 822 N. Van Buren St."));
  it("keeps ordinal street names readable", () =>
    expect(placeHeading("A change in zoning at 3473 South 27th Street, in the 11th Aldermanic District.", "260532")).toBe("3473 S. 27th St."));
  it("summarizes long address lists", () =>
    expect(placeHeading("Zoning at 100 West Wells Street, 200 West Wells Street and 300 West Wells Street.", "1")).toBe("100 W. Wells St. and 2 more"));
  it("falls back to the file number when the title names no address", () =>
    expect(placeHeading("A substitute ordinance relating to zoning text.", "260001")).toBe("File 260001"));
});

describe("labels", () => {
  it("kinds", () => {
    expect(kindLabel("rezoning")).toBe("REZONING");
    expect(kindLabel("dpd-amendment")).toBe("DPD AMENDMENT");
    expect(kindLabel("minor-modification")).toBe("MINOR MODIFICATION");
    expect(kindLabel("unexpected")).toBe("ZONING");
  });
  it("bodies read in normal case", () => {
    expect(bodyLabel("COMMON COUNCIL")).toBe("Common Council");
    expect(bodyLabel("CITY PLAN COMMISSION")).toBe("City Plan Commission");
    // Same label the project page timeline uses (lib/timeline/build.ts).
    expect(bodyLabel("ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE")).toBe("Zoning, Neighborhoods & Development");
  });
  it("hearing date is shown in Milwaukee time", () =>
    expect(hearingLabel({ date: "2026-11-04T09:00:00-06:00", body: "COMMON COUNCIL" })).toBe("Next: Common Council, Wed, Nov 4"));
  it("empty states name the filter and the half-mile radius", () => {
    expect(emptyMessage("all")).toBe("No active files within half a mile.");
    expect(emptyMessage("upcoming")).toBe("No upcoming hearings within half a mile.");
    expect(emptyMessage("decided")).toBe("No decided files within half a mile.");
  });
});

describe("parseSavedPlace (device storage is untrusted)", () => {
  const ok = { lat: 43.04, lng: -87.9, matchedAddress: "711 E KILBOURN AVE, MILWAUKEE, WI, 53202" };
  it("accepts a well-formed place", () => expect(parseSavedPlace(JSON.stringify(ok))).toEqual(ok));
  it("keeps a valid alder district", () => expect(parseSavedPlace(JSON.stringify({ ...ok, district: 4 }))).toEqual({ ...ok, district: 4 }));
  it("drops a district that is not a whole number from 1 to 15", () => {
    expect(parseSavedPlace(JSON.stringify({ ...ok, district: 0 }))).toEqual(ok);
    expect(parseSavedPlace(JSON.stringify({ ...ok, district: "4" }))).toEqual(ok);
  });
  it.each([null, "", "not json", "[]", JSON.stringify({ ...ok, lat: "43" }), JSON.stringify({ ...ok, lng: 500 }), JSON.stringify({ ...ok, matchedAddress: "x".repeat(300) })])(
    "rejects %s",
    (raw) => expect(parseSavedPlace(raw)).toBeNull(),
  );
});

describe("shortAddress", () => {
  it("keeps the street line of the Census match, readable", () =>
    expect(shortAddress("711 E KILBOURN AVE, MILWAUKEE, WI, 53202")).toBe("711 E Kilbourn Ave"));
  it("reads city-record type codes as people write them", () => expect(shortAddress("711 E KILBOURN AV, MILWAUKEE, WI")).toBe("711 E Kilbourn Ave"));
  it("chip text adds the district when known", () => {
    expect(chipText({ lat: 1, lng: 1, matchedAddress: "711 E KILBOURN AV, MILWAUKEE, WI", district: 4 })).toBe("711 E Kilbourn Ave · District 4");
    expect(chipText({ lat: 1, lng: 1, matchedAddress: "711 E KILBOURN AV, MILWAUKEE, WI" })).toBe("711 E Kilbourn Ave");
  });
});

describe("distanceLabel", () => {
  it("the searched lot itself reads as the resident's address", () => expect(distanceLabel(0)).toBe("At your address"));
  it("other files show miles", () => expect(distanceLabel(0.12)).toBe("0.12 mi away"));
});
