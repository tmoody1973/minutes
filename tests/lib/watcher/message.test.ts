import { describe, expect, it } from "vitest";
import { alertMessage } from "../../../lib/watcher/message";

const BOOKENDS = "A substitute ordinance relating to the change in zoning ... at 711 East Kilbourn Avenue and 822 North Van Buren Street, in the 4th Aldermanic District.";
const SOUTHGATE = "A substitute ordinance relating to the 5th Amendment ... at 3473 South 27th Street, in the 11th Aldermanic District.";

describe("alertMessage (record fields only)", () => {
  it("an introduced file says what was done, where and when, and what Minutes does next", () =>
    expect(alertMessage({ kind: "introduced", fileNumber: "260809", title: "A substitute charter ordinance relating to contracts for automated license plate reader technology.", bodyName: "COMMON COUNCIL", date: "2026-09-22T00:00:00", actionName: "ASSIGNED TO" }).message).toBe(
      "New file: File 260809 (contracts for automated license plate reader technology): Assigned at Common Council, Sep 22, 2026. Minutes will email you when it is put on an agenda or decided.",
    ));
  it("a scheduled hearing names the body and the meeting time in Milwaukee", () =>
    expect(alertMessage({ kind: "hearing_scheduled", fileNumber: "260533", title: BOOKENDS, bodyName: "COMMON COUNCIL", startsAt: "2026-11-04T09:00:00-06:00" })).toEqual({
      message: "711 E. Kilbourn Ave. and 822 N. Van Buren St. is on the Common Council agenda for Wed, Nov 4, 9:00 AM.",
      href: "/files/260533",
    }));
  it("a decision quotes the recorded action, body and date", () =>
    expect(alertMessage({ kind: "decision", fileNumber: "260532", title: SOUTHGATE, bodyName: "COMMON COUNCIL", date: "2026-10-13T00:00:00", actionName: "PASSED" })).toEqual({
      message: "3473 S. 27th St.: Passed at Common Council, Oct 13, 2026.",
      href: "/files/260532",
    }));
  it("a file with no address is named by its title's own subject, quoted from the record", () => {
    const ALPR = "A substitute charter ordinance relating to contracts for automated license plate reader technology.";
    expect(alertMessage({ kind: "decision", fileNumber: "260809", title: ALPR, bodyName: "FINANCE & PERSONNEL COMMITTEE", date: "2026-10-28T00:00:00", actionName: "RECOMMENDED FOR PASSAGE" }).message).toBe(
      "File 260809 (contracts for automated license plate reader technology): Recommended for passage at Finance & Personnel Committee, Oct 28, 2026.",
    );
    const long = `Communication relating to ${"the annual report of the department ".repeat(4)}.`;
    expect(alertMessage({ kind: "decision", fileNumber: "260001", title: long, date: "2026-10-28T00:00:00" }).message).toMatch(/^File 260001 \(the annual report .{20,90}…\): /);
  });
  it("missing record fields leave words out rather than guess", () =>
    expect(alertMessage({ kind: "decision", fileNumber: "260532", title: "A resolution.", date: "2026-10-13T00:00:00" }).message).toBe(
      "File 260532: Decision recorded, Oct 13, 2026.",
    ));
});
