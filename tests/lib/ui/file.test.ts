import { describe, expect, it } from "vitest";
import { actionText, commentPage, COMMENT_PAGES, hearingIcs, isFileNumber, outlineSvg, purposeLine, sourceDocs, stepDate, subjectOf, tallyText } from "../../../lib/ui/file";

const BOOKENDS =
  "A substitute ordinance relating to the change in zoning from General Planned Development known as Bookends to a Detailed Planned Development known as Zenith to allow the construction of a multi-family residential building at 711 East Kilbourn Avenue and 822 North Van Buren Street, on the east side of North Van Buren Street, south of East Kilbourn Avenue, in the 4th Aldermanic District.";
const SOUTHGATE =
  "A substitute ordinance relating to the 5th Amendment to the Detailed Planned Development known as Southgate Marketplace, Phase 1 to allow the construction of a bank with drive-through ATM at 3473 South 27th Street, on the west side of South 27th Street, north of West Morgan Avenue, in the 11th Aldermanic District.";

describe("actionText", () => {
  it("sentence-cases Legistar actions and fixes their spacing", () =>
    expect(actionText(["APPROVED CONDITIONALLY", "RECOMMENDED FOR  PASSAGE"])).toBe("Approved conditionally; Recommended for passage"));
  it("reads the timeline's own markers", () => {
    expect(actionText(["SCHEDULED"])).toBe("Scheduled");
    expect(actionText(["ON AGENDA"])).toBe("On the agenda");
  });
  it("drops the dangling 'to' Legistar leaves when the receiving body sits in another column", () =>
    expect(actionText(["ASSIGNED TO", "REFERRED WITHOUT RECOMMENDATION AND ASSIGNED TO"])).toBe("Assigned; Referred without recommendation and assigned"));
});

describe("actionText repeats", () => {
  it("counts a repeated action instead of listing it again", () =>
    expect(actionText(["AMENDED", "AMENDED", "AMENDED (WITHDRAWN)", "AMENDED", "REFERRED WITHOUT RECOMMENDATION"])).toBe(
      "Amended, 3 times; Amended (withdrawn); Referred without recommendation",
    ));
});

describe("isFileNumber", () => {
  it("City Hall files are 5 to 7 digits; Fire and Police Commission files carry FPC", () => {
    for (const ok of ["260809", "FPC212700", "fpc212700"]) expect(isFileNumber(ok)).toBe(true);
    for (const bad of ["2608", "FPC", "ABC212700", "260809x", ""]) expect(isFileNumber(bad)).toBe(false);
  });
});

describe("subjectOf", () => {
  it("names a file by its title's subject, without a dangling its or their", () => {
    expect(subjectOf("Communication from the Mayor relating to the proposed 2027 budget.")).toBe("the proposed 2027 budget");
    expect(subjectOf("Communication from the Milwaukee Police Department relating to its use of cameras.")).toBe("use of cameras");
    expect(subjectOf("A resolution approving a lease.")).toBeNull();
  });
});

describe("tallyText", () => {
  it("ayes and noes, then excused and other only when present", () => {
    expect(tallyText({ aye: 5, no: 0, excused: 2, other: 0 })).toBe("Vote 5–0, 2 excused");
    expect(tallyText({ aye: 5, no: 0, excused: 0, other: 0 })).toBe("Vote 5–0");
    expect(tallyText({ aye: 8, no: 6, excused: 0, other: 1 })).toBe("Vote 8–6, 1 other");
  });
});

describe("stepDate", () => {
  it("past dates are short", () => expect(stepDate("2026-09-28")).toBe("Sep 28, 2026"));
  it("an exact start time reads in Milwaukee time with weekday", () =>
    expect(stepDate("2026-11-04", "2026-11-04T09:00:00-06:00")).toBe("Wed, Nov 4, 9:00 AM"));
});

describe("purposeLine", () => {
  it("quotes the title's own purpose clause", () => {
    expect(purposeLine(BOOKENDS)).toBe("To allow the construction of a multi-family residential building.");
    expect(purposeLine(SOUTHGATE)).toBe("To allow the construction of a bank with drive-through ATM.");
  });
  it("nothing when the title states no purpose", () => expect(purposeLine("A change in zoning at 1 N Test St.")).toBeNull());
});

describe("outlineSvg", () => {
  it("fits lot outlines into the box, north up, keeping their shape", () => {
    const sq = { type: "Polygon", coordinates: [[[-87.9, 43.0], [-87.89, 43.0], [-87.89, 43.01], [-87.9, 43.01], [-87.9, 43.0]]] };
    const r = outlineSvg([sq], 200, 100, 10)!;
    expect(r.paths).toHaveLength(1);
    expect(r.paths[0]).toMatch(/^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+)+Z$/);
    // Taller than wide on the ground (0.01 deg lat > 0.01 deg lng at 43N), so height fills the box minus padding.
    const ys = [...r.paths[0].matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeCloseTo(10, 0);
    expect(Math.max(...ys)).toBeCloseTo(90, 0);
  });
  it("handles MultiPolygon and skips missing outlines", () => {
    const multi = { type: "MultiPolygon", coordinates: [[[[-87.9, 43], [-87.89, 43], [-87.89, 43.01], [-87.9, 43]]]] };
    expect(outlineSvg([multi, null], 200, 100, 10)!.paths).toHaveLength(1);
  });
  it("null when no lot has an outline", () => expect(outlineSvg([null], 200, 100, 10)).toBeNull());
});

describe("sourceDocs", () => {
  it("picks the staff report and the latest Exhibit A by name", () => {
    const a = (name: string) => ({ name, hyperlink: `https://x/${encodeURIComponent(name)}` });
    expect(sourceDocs([a("Map"), a("Exhibit A as of 09.15.26"), a("CPC Staff Report"), a("Exhibit A as of 09.25.26"), a("Exhibit A as of 09.21.26")]).map((d) => d.label)).toEqual([
      "Staff report",
      "Exhibit A",
    ]);
    expect(sourceDocs([a("Exhibit A as of 09.15.26"), a("Exhibit A as of 09.25.26"), a("Exhibit A as of 09.21.26")])[0].hyperlink).toContain("09.25.26");
  });
});

describe("commentPage", () => {
  it("hidden until Tarik confirms the link", () => {
    for (const body of Object.keys(COMMENT_PAGES)) expect(commentPage(body, {})).toBeNull();
  });
  it("live: only the CPC page is confirmed", () => {
    expect(commentPage("City Plan Commission")?.url).toBe("https://city.milwaukee.gov/DCD/Planning/CPC");
    expect(commentPage("Zoning, Neighborhoods & Development")).toBeNull();
    expect(commentPage("Common Council")).toBeNull();
  });
  it("returns the city's page once confirmed", () =>
    expect(commentPage("City Plan Commission", { "City Plan Commission": true })?.url).toBe("https://city.milwaukee.gov/DCD/Planning/CPC"));
});

describe("hearingIcs", () => {
  it("one VEVENT in UTC with file and body, CRLF line endings", () => {
    const ics = hearingIcs(
      { fileNumber: "260533", heading: "711 E. Kilbourn Ave.", body: "Common Council", startsAt: "2026-11-04T09:00:00-06:00", eventId: 13430, pageUrl: "https://minutes.example/files/260533" },
      new Date("2026-10-30T12:00:00Z"),
    );
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("DTSTART:20261104T150000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261030T120000Z\r\n");
    expect(ics).toContain("SUMMARY:Common Council: file 260533\\, 711 E. Kilbourn Ave.\r\n");
    expect(ics).toContain("UID:minutes-13430-260533@minutes\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("folds lines longer than 75 characters (RFC 5545)", () => {
    const ics = hearingIcs(
      { fileNumber: "260533", heading: "711 E. Kilbourn Ave. and 822 N. Van Buren St.", body: "Zoning, Neighborhoods & Development", startsAt: "2026-11-04T09:00:00-06:00", eventId: 1, pageUrl: "https://minutes.example/files/260533" },
      new Date("2026-10-30T12:00:00Z"),
    );
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:Zoning\\, Neighborhoods & Development: file 260533\\, 711 E. Kilbourn Ave. and 822 N. Van Buren St.");
  });
});
