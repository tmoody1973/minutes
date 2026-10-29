import { describe, expect, it } from "vitest";
import { eventsFilter, hasVotes, matterIdsOf, memberFilter, syncWindow } from "@/lib/legistar/plan";

describe("syncWindow", () => {
  it("spans days back to days ahead as YYYY-MM-DD", () => {
    expect(syncWindow(new Date("2026-10-29T15:00:00Z"), 14, 60)).toEqual({ since: "2026-10-15", until: "2026-12-28" });
  });
});

describe("eventsFilter", () => {
  it("ORs body ids inside a date range", () => {
    expect(eventsFilter("2026-01-01", "2026-12-31", [1, 11])).toBe(
      "EventDate ge datetime'2026-01-01' and EventDate le datetime'2026-12-31' and (EventBodyId eq 1 or EventBodyId eq 11)",
    );
  });
});

describe("memberFilter", () => {
  it("keeps one body's records ending on or after today", () => {
    expect(memberFilter(272, "2026-10-29")).toBe("OfficeRecordBodyId eq 272 and OfficeRecordEndDate ge datetime'2026-10-29'");
  });
});

describe("matterIdsOf", () => {
  it("dedupes and drops items without a matter", () => {
    expect(matterIdsOf([{ matterId: 5 }, { matterId: undefined }, { matterId: 5 }, { matterId: 7 }])).toEqual([5, 7]);
  });
});

describe("hasVotes", () => {
  it("is true only for items with a recorded action or result", () => {
    expect(hasVotes({ actionName: "PASSED" })).toBe(true);
    expect(hasVotes({ passed: false })).toBe(true);
    expect(hasVotes({})).toBe(false);
  });
});
