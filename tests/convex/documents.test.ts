// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const PDF = "https://milwaukee.legistar1.com/milwaukee/attachments/a.pdf";

async function seed() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.legistar.upsertMatter, { legistarId: 9, fileNumber: "260809", title: "A substitute charter ordinance relating to contracts for automated license plate reader technology.", typeName: "Charter Ordinance", statusName: "In Council" });
  await t.mutation(internal.legistar.upsertHistory, { legistarId: 1, matterId: 9, date: "2026-10-28T00:00:00", bodyName: "FINANCE & PERSONNEL COMMITTEE", actionName: "SUBSTITUTED" });
  return t;
}

describe("documents", () => {
  it("saves each document's passages once and lets Ask search inside them", async () => {
    const t = await seed();
    const doc = { hyperlink: PDF, name: "Fiscal Note", matterId: 9, fileNumber: "260809", passages: ["The contract costs $1,200,000 over three years.", "Data is kept for 30 days."] };
    await t.mutation(internal.documents.saveDocs, { docs: [doc] });
    await t.mutation(internal.documents.saveDocs, { docs: [{ ...doc, passages: ["changed"] }] }); // already stored: skipped
    expect(await t.query(internal.documents.storedHyperlinks, { hyperlinks: [PDF, "https://x/b.pdf"] })).toEqual([PDF]);
    const recs = await t.query(api.ask.findInDocuments, { q: "kept days" });
    expect(recs).toEqual([
      { key: expect.stringMatching(/^doc:/), label: "Fiscal Note, file 260809", text: 'From "Fiscal Note", attached to file 260809: Data is kept for 30 days.', href: "/files/260809" },
    ]);
  });
  it("a scanned document with no text is remembered, so it isn't downloaded again", async () => {
    const t = await seed();
    await t.mutation(internal.documents.saveDocs, { docs: [{ hyperlink: PDF, name: "Exhibit", matterId: 9, fileNumber: "260809", passages: [] }] });
    expect(await t.query(internal.documents.storedHyperlinks, { hyperlinks: [PDF] })).toEqual([PDF]);
    expect(await t.query(api.ask.findInDocuments, { q: "exhibit" })).toEqual([]);
  });
});
