// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const BOOKENDS =
  "A substitute ordinance relating to the change in zoning from General Planned Development (GPD) to Detailed Planned Development (DPD) known as Zenith, for a multi-family residential building, on land located at 711 East Kilbourn Avenue and 822 North Van Buren Street, in the 4th Aldermanic District.";
const lot = { taxkey: "3930942000", address: "711 E KILBOURN AV", zoning: "PD", alder: 4, lotAreaSqFt: 30000, owner: "SOME OWNER LLC", polygon: null, centroid: { lat: 43.04246, lng: -87.90278 } };

async function bookends() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.legistar.upsertMatter, { legistarId: 74560, fileNumber: "260533", title: BOOKENDS, typeName: "Ordinance", statusName: "In Council-Passage" });
  await t.mutation(internal.legistar.setMatterParcels, { matterId: 74560, parcels: [lot] });
  await t.mutation(internal.legistar.upsertHistory, { legistarId: 495640, matterId: 74560, date: "2026-09-28T00:00:00", bodyName: "CITY PLAN COMMISSION", actionName: "APPROVED CONDITIONALLY", passed: true });
  return t;
}

describe("cardSources", () => {
  it("keys each record and never includes the owner", async () => {
    const t = await bookends();
    const { sources, storedHash } = await t.query(internal.editor.cardSources, { kind: "file", key: "260533" });
    expect(storedHash).toBeNull();
    expect(sources!.map((s) => s.key)).toEqual(["matter:74560", "zoning:74560", "parcel:3930942000", "history:495640"]);
    const text = Object.fromEntries(sources!.map((s) => [s.key, s.text]));
    expect(text["history:495640"]).toBe("Sep 28, 2026: City Plan Commission: APPROVED CONDITIONALLY (passed).");
    expect(text["parcel:3930942000"]).toBe("Lot at 711 E KILBOURN AV: zoned PD, lot area 30,000 sq ft, aldermanic district 4.");
    expect(text["zoning:74560"]).toBe("Zoning change requested from General Planned Development (GPD) to Detailed Planned Development (DPD).");
    expect(JSON.stringify(sources)).not.toContain("OWNER");
  });
  it("is null for a file that is not stored", async () => {
    const t = await bookends();
    expect((await t.query(internal.editor.cardSources, { kind: "file", key: "999999" })).sources).toBeNull();
  });
});

describe("saveCard + card", () => {
  it("stores only approved sentences, logs every verdict, and shows each sentence's sources", async () => {
    const t = await bookends();
    const kept = await t.mutation(internal.editor.saveCard, {
      kind: "file",
      key: "260533",
      sourcesHash: "h1",
      sourceLabels: { "history:495640": "City Plan Commission, Sep 28, 2026", "matter:74560": "File 260533" },
      sentences: [
        { text: "The City Plan Commission approved it with conditions on Sep 28, 2026.", sourceKeys: ["history:495640"], verdict: { ok: true } },
        { text: "It is a welcome improvement.", sourceKeys: ["matter:74560"], verdict: { ok: false, reason: "evaluative", detail: "welcome" } },
      ],
    });
    expect(kept).toBe(1);
    expect(await t.query(api.editor.card, { kind: "file", key: "260533" })).toMatchObject({
      sentences: [{ text: "The City Plan Commission approved it with conditions on Sep 28, 2026.", sources: ["City Plan Commission, Sep 28, 2026"] }],
    });
    const log = await t.run((ctx) => ctx.db.query("editorLog").collect());
    expect(log.map((l) => [l.ok, l.reason ?? null])).toEqual([
      [true, null],
      [false, "evaluative"],
    ]);
    expect((await t.query(internal.editor.cardSources, { kind: "file", key: "260533" })).storedHash).toBe("h1");
  });
  it("refuses a sentence marked ok that fails the cheap checks (no source, unlabeled source, evaluative)", async () => {
    const t = await bookends();
    const ok = { ok: true };
    const kept = await t.mutation(internal.editor.saveCard, {
      kind: "file",
      key: "260533",
      sourcesHash: "h1",
      sourceLabels: { "history:495640": "City Plan Commission, Sep 28, 2026" },
      sentences: [
        { text: "No source.", sourceKeys: [], verdict: ok },
        { text: "Unlabeled source.", sourceKeys: ["history:1"], verdict: ok },
        { text: "A welcome approval.", sourceKeys: ["history:495640"], verdict: ok },
      ],
    });
    expect(kept).toBe(0);
    expect(await t.query(api.editor.card, { kind: "file", key: "260533" })).toBeNull();
  });
  it("shows nothing when every sentence was rejected", async () => {
    const t = await bookends();
    await t.mutation(internal.editor.saveCard, {
      kind: "file",
      key: "260533",
      sourcesHash: "h1",
      sourceLabels: {},
      sentences: [{ text: "x", sourceKeys: [], verdict: { ok: false, reason: "no-source" } }],
    });
    expect(await t.query(api.editor.card, { kind: "file", key: "260533" })).toBeNull();
  });
});
