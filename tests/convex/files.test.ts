// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const TITLE = "A substitute ordinance relating to the change in zoning from General Planned Development known as Bookends to a Detailed Planned Development known as Zenith at 711 East Kilbourn Avenue.";
const lot = {
  taxkey: "3930942000", address: "711 E KILBOURN AV", zoning: "PD", alder: 4, lotAreaSqFt: 30000, owner: "PRIVATE OWNER LLC",
  polygon: { type: "Polygon", coordinates: [[[-87.903, 43.042], [-87.902, 43.042], [-87.902, 43.043], [-87.903, 42.042]]] },
  centroid: { lat: 43.0425, lng: -87.9028 },
};

async function seed() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.legistar.upsertMatter, {
    legistarId: 74560, fileNumber: "260533", title: TITLE, typeName: "Ordinance", statusName: "In Council-Passage",
    attachments: [{ name: "Exhibit A", hyperlink: "https://milwaukee.legistar.com/x.pdf" }],
  });
  await t.mutation(internal.legistar.setMatterParcels, { matterId: 74560, parcels: [lot] });
  await t.mutation(internal.legistar.upsertEvent, { legistarId: 13559, bodyId: 272, bodyName: "CITY PLAN COMMISSION", startsAt: "2026-09-28T13:30:00-05:00", clipId: 5101 });
  await t.mutation(internal.legistar.upsertEvent, { legistarId: 13430, bodyId: 1, bodyName: "COMMON COUNCIL", startsAt: "2999-11-04T09:00:00-06:00" });
  await t.mutation(internal.legistar.upsertEventItem, { legistarId: 900, eventId: 13559, sequence: 3, matterId: 74560, title: "t", videoStartSec: 2055 });
  await t.mutation(internal.legistar.setEventItemTally, { eventItemLegistarId: 900, tally: { aye: 5, no: 0, excused: 2, other: 0 } });
  await t.mutation(internal.legistar.upsertEventItem, { legistarId: 901, eventId: 13430, sequence: 7, matterId: 74560, title: "t" });
  await t.mutation(internal.legistar.upsertHistory, { legistarId: 1, matterId: 74560, date: "2026-07-31T00:00:00", bodyName: "COMMON COUNCIL", actionName: "ASSIGNED TO" });
  await t.mutation(internal.legistar.upsertHistory, { legistarId: 2, matterId: 74560, date: "2026-09-28T00:00:00", bodyName: "CITY PLAN COMMISSION", actionName: "APPROVED CONDITIONALLY", passed: true, eventId: 13559 });
  return t;
}

describe("fileView", () => {
  it("returns the record, ordered timeline with tally and video clip, history rows, lots and attachments", async () => {
    const t = await seed();
    const v = (await t.query(api.files.fileView, { fileNumber: "260533" }))!;
    expect(v.matter).toMatchObject({ fileNumber: "260533", title: TITLE, statusName: "In Council-Passage" });
    expect(v.timeline.map((s) => [s.body, s.actions, s.upcoming])).toEqual([
      ["Common Council", ["ASSIGNED TO"], false],
      ["City Plan Commission", ["APPROVED CONDITIONALLY"], false],
      ["Common Council", ["SCHEDULED"], true],
    ]);
    expect(v.timeline[1]).toMatchObject({ tally: { aye: 5, no: 0, excused: 2, other: 0 }, videoStartSec: 2055, clipId: 5101 });
    expect(v.timeline[2].clipId).toBeUndefined();
    expect(v.timeline[2].startsAt).toBe("2999-11-04T09:00:00-06:00");
    expect(v.timeline[0].startsAt).toBeUndefined();
    expect(v.histories.map((h) => h.actionName)).toEqual(["ASSIGNED TO", "APPROVED CONDITIONALLY"]);
    expect(v.attachments).toEqual([{ name: "Exhibit A", hyperlink: "https://milwaukee.legistar.com/x.pdf" }]);
    expect(v.parcels).toHaveLength(1);
    expect(v.parcels[0]).toMatchObject({ taxkey: "3930942000", zoning: "PD", alder: 4 });
  });

  it("never returns the lot owner's name", async () => {
    const t = await seed();
    const v = (await t.query(api.files.fileView, { fileNumber: "260533" }))!;
    expect(JSON.stringify(v)).not.toContain("PRIVATE OWNER");
  });

  it("a Fire and Police Commission file (FPC number) has a page too", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertMatter, { legistarId: 77, fileNumber: "FPC212700", title: "Communication from the Milwaukee Police Department relating to automated license plate readers.", typeName: "Communication", statusName: "Placed On File" });
    expect((await t.query(api.files.fileView, { fileNumber: "FPC212700" }))?.matter.fileNumber).toBe("FPC212700");
  });
  it("null for an unknown file; rejects a malformed file number", async () => {
    const t = await seed();
    expect(await t.query(api.files.fileView, { fileNumber: "999999" })).toBeNull();
    await expect(t.query(api.files.fileView, { fileNumber: "26053'; drop" })).rejects.toThrow(/file number/);
  });
});
