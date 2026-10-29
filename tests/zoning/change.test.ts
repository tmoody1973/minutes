import { describe, expect, it } from "vitest";
import { parseZoningChange } from "@/lib/zoning/change";

describe("parseZoningChange", () => {
  it("Bookends rezoning", () => {
    expect(parseZoningChange("A substitute ordinance relating to the change in zoning from General Planned Development known as Bookends to a Detailed Planned Development known as Zenith to allow the construction of a multi-family residential building at 711 East Kilbourn Avenue")).toEqual({
      from: "General Planned Development", to: "Detailed Planned Development", kind: "rezoning",
    });
  });
  it("Everett: 'to a new Detailed Planned Development'", () => {
    expect(parseZoningChange("A substitute ordinance relating to the change in zoning from General Planned Development to a new Detailed Planned Development known as The Everett Multifamily to allow a multi-family residential development")).toEqual({
      from: "General Planned Development", to: "Detailed Planned Development", kind: "rezoning",
    });
  });
  it("Bader: keeps full from phrase", () => {
    const r = parseZoningChange("A substitute ordinance relating to the change in zoning from Two-Family Residential, RT4, and Local Business, LB2, for the properties located at 410 West Concordia Avenue and 3301 and 3307 North Vel R. Phillips Avenue to Detailed Planned Development, DPD, and the 1st Amendment to the DPD known as Bader Philanthropies");
    expect(r.kind).toBe("rezoning");
    expect(r.from).toBe("Two-Family Residential, RT4, and Local Business, LB2");
    expect(r.to).toBe("Detailed Planned Development, DPD");
  });
  it("dpd-amendment", () => {
    expect(parseZoningChange("A substitute ordinance relating to the 5th Amendment to the Detailed Planned Development known as Southgate Marketplace, Phase 1 to allow the construction of a bank at 3473 South 27th Street")).toEqual({ kind: "dpd-amendment" });
  });
  it("minor-modification", () => {
    expect(parseZoningChange("Substitute resolution relating to a Minor Modification to the Detailed Planned Development known as Kane Commons, Phase 1 to allow exterior alterations")).toEqual({ kind: "minor-modification" });
  });
  it("text", () => {
    expect(parseZoningChange("A substitute ordinance relating to zoning regulations for family day care homes.")).toEqual({ kind: "text" });
  });
  it("other", () => {
    expect(parseZoningChange("Communication from the Department of City Development")).toEqual({ kind: "other" });
  });
});
