import { describe, expect, it } from "vitest";
import { parseZoningChange } from "@/lib/zoning/change";
import titles from "../fixtures/legistar/zoning-titles.json";

const t = (file: string) => titles.find((x) => x.file === file)!.title;

describe("parseZoningChange", () => {
  it("Bookends rezoning", () => {
    expect(parseZoningChange(t("260533"))).toEqual({
      from: "General Planned Development", to: "Detailed Planned Development", kind: "rezoning",
    });
  });
  it("Everett: 'to a new Detailed Planned Development'", () => {
    expect(parseZoningChange(t("252190"))).toEqual({
      from: "General Planned Development", to: "Detailed Planned Development", kind: "rezoning",
    });
  });
  it("Bader: keeps full from phrase", () => {
    const r = parseZoningChange(t("252189"));
    expect(r.kind).toBe("rezoning");
    expect(r.from).toBe("Two-Family Residential, RT4, and Local Business, LB2");
    expect(r.to).toBe("Detailed Planned Development, DPD");
  });
  it("dpd-amendment", () => {
    expect(parseZoningChange(t("260532"))).toEqual({ kind: "dpd-amendment" });
  });
  it("minor-modification", () => {
    expect(parseZoningChange(t("260047"))).toEqual({ kind: "minor-modification" });
  });
  it("text", () => {
    expect(parseZoningChange(t("260642"))).toEqual({ kind: "text" });
  });
  it("other", () => {
    expect(parseZoningChange("Communication from the Department of City Development")).toEqual({ kind: "other" });
  });
});
