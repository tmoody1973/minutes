import { describe, expect, it } from "vitest";
import { normalizeFollow } from "../../../convex/follows";
import { alertable, matchesFollow } from "../../../lib/watcher/match";

const decision = { kind: "decision" as const, matterId: 74560, at: "2026-11-04", sourceKey: "history:1" };
// Bookends: lots near 711 E Kilbourn, District 4.
const matter = {
  fileNumber: "260533",
  title: "A substitute ordinance relating to the change in zoning ... multi-family residential building at 711 East Kilbourn Avenue ...",
  centroids: [{ lat: 43.04246, lng: -87.90278 }],
  alders: [4],
};
const follow = (kind: "file" | "address" | "alder" | "topic", value: string) => ({ userId: "u", kind, value });

describe("matchesFollow", () => {
  it("a file follow matches only its own file", () => {
    expect(matchesFollow(decision, follow("file", "260533"), matter)).toBe(true);
    expect(matchesFollow(decision, follow("file", "260532"), matter)).toBe(false);
  });
  it("an address follow matches a lot within half a mile, not beyond", () => {
    expect(matchesFollow(decision, follow("address", "43.0430,-87.9000"), matter)).toBe(true); // ~0.15 mi
    expect(matchesFollow(decision, follow("address", "42.9815,-87.9486"), matter)).toBe(false); // Southgate, ~4.8 mi
  });
  it("an alder follow matches the lot's district", () => {
    expect(matchesFollow(decision, follow("alder", "4"), matter)).toBe(true);
    expect(matchesFollow(decision, follow("alder", "11"), matter)).toBe(false);
  });
  it("a topic follow matches words in the file title, case-insensitive", () => {
    expect(matchesFollow(decision, follow("topic", "Multi-family"), matter)).toBe(true);
    expect(matchesFollow(decision, follow("topic", "data centers"), matter)).toBe(false);
  });
  it("a concern's words match when any one of them is in the title", () => {
    expect(matchesFollow(decision, follow("topic", "data centers, kilbourn"), matter)).toBe(true);
    expect(matchesFollow(decision, follow("topic", "data centers, flock"), matter)).toBe(false);
  });
  it("a plural word also matches the singular in a title", () => {
    expect(matchesFollow(decision, follow("topic", "residential buildings"), matter)).toBe(true);
    expect(matchesFollow(decision, follow("topic", "class"), { ...matter, title: "Class B tavern" })).toBe(true);
  });
  it("malformed follow values never match", () => {
    expect(matchesFollow(decision, follow("address", "not,a place"), matter)).toBe(false);
    expect(matchesFollow(decision, follow("alder", "four"), matter)).toBe(false);
    expect(matchesFollow(decision, follow("topic", "  "), matter)).toBe(false);
  });
});

describe("alertable (quiet by default)", () => {
  it("hearings scheduled and decisions alert; plain steps do not", () => {
    expect(alertable("hearing_scheduled")).toBe(true);
    expect(alertable("decision")).toBe(true);
    expect(alertable("step_added")).toBe(false);
  });
});

describe("normalizeFollow for a concern", () => {
  it("keeps 1 to 5 distinct lowercase words of 3 to 40 characters", () => {
    expect(normalizeFollow("topic", " Surveillance,  camera ,CAMERA, x , license plate reader")).toBe("surveillance, camera, license plate reader");
    expect(normalizeFollow("topic", "one1, two2, three, four, five, six").split(", ")).toHaveLength(5);
  });
  it("drops a phrase that already contains a watched word", () => expect(normalizeFollow("topic", "proposed 2027 budget, 2027 budget")).toBe("2027 budget"));
  it("refuses a concern with no usable word", () => expect(() => normalizeFollow("topic", " x, , y ")).toThrow());
});
