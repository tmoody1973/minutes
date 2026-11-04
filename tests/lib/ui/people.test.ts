import { describe, expect, it } from "vitest";
import { districtOf, memberName, sortMembers } from "../../../lib/ui/people";

describe("people", () => {
  it("names read in normal case, the way the city writes them otherwise", () => {
    expect(memberName("ALD. A. PRATT")).toBe("Ald. A. Pratt");
    expect(memberName("ALD. CHAMBERS JR.")).toBe("Ald. Chambers Jr.");
  });
  it("a Common Council seat's district comes from its Legistar title", () => {
    expect(districtOf("4th District")).toBe(4);
    expect(districtOf("11th District")).toBe(11);
    expect(districtOf("Chair")).toBeNull();
    expect(districtOf(undefined)).toBeNull();
  });
  it("members are listed alphabetically, roles shown but not ranked", () =>
    expect(sortMembers([{ personId: 2, name: "Ald. Perez", role: "Chair" }, { personId: 1, name: "Ald. Bauman" }]).map((m) => m.name)).toEqual(["Ald. Bauman", "Ald. Perez"]));
});
