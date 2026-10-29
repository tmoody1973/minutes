// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const matter = { legistarId: 1, fileNumber: "260532", title: "t", typeName: "Ordinance", statusName: "In Committee" };

describe("exhibitCheck", () => {
  it("setExhibitCheck stores agrees/iou/checkedAt, getMatterByFileNumber finds the row, and a later matter upsert leaves it alone", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.legistar.upsertMatter, matter);
    const check = { agrees: true, iou: 0.91, checkedAt: 1000 };
    await t.mutation(internal.legistar.setExhibitCheck, { fileNumber: "260532", ...check });
    await t.mutation(internal.legistar.upsertMatter, { ...matter, title: "t2" });
    const row = await t.query(internal.legistar.getMatterByFileNumber, { fileNumber: "260532" });
    expect(row?.exhibitCheck).toEqual(check);
    expect(await t.query(internal.legistar.getMatterByFileNumber, { fileNumber: "nope" })).toBeNull();
  });
});
