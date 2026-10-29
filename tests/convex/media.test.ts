// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const turn = (k: string, startMs: number, label: string | undefined, text = "hi") => ({ turnKey: k, chunk: 0, startMs, endMs: startMs + 10, label, text, source: "transcript" as const });
const keys = (t: ReturnType<typeof convexTest>, eventId: number) => t.query(internal.media.turnKeysForEvent, { eventId }).then((k) => k.sort());

describe("turn writes", () => {
  it("re-write is idempotent and removes only this event's stale keys", async () => {
    const t = convexTest(schema, modules);
    const turns = [turn("0:1", 0, "c0:A"), turn("0:2", 20, "c0:B")];
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns });
    await t.mutation(internal.media.upsertTurns, { eventId: 2, turns: [turn("0:1", 0, "c0:A"), turn("0:9", 5, undefined)] });
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns });
    expect(await keys(t, 1)).toEqual(["0:1", "0:2"]);
    // new ingest drops 0:2 and edits 0:1
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns: [turn("0:1", 0, "c0:A", "edited")] });
    const stored = await keys(t, 1);
    await t.mutation(internal.media.removeTurns, { eventId: 1, turnKeys: stored.filter((k) => k !== "0:1") });
    expect(await keys(t, 1)).toEqual(["0:1"]);
    expect(await keys(t, 2)).toEqual(["0:1", "0:9"]);
    const view = await t.query(api.media.meetingView, { eventId: 1 });
    expect(view.turns.map((x) => x.text)).toEqual(["edited"]);
  });
});

describe("overrides", () => {
  it("survive ingest writes; meetingView applies them and omits `by`", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.media.upsertTurns, { eventId: 1, turns: [turn("0:1", 0, "c0:A"), turn("0:2", 20, "c0:B")] });
    await t.mutation(internal.media.replaceAssignments, { eventId: 1, assignments: [{ label: "c0:A", name: "Auto Name", source: "legistar", evidenceTurnKey: "0:1" }] });
    await t.mutation(internal.media.setOverride, { eventId: 1, label: "c0:A", name: "Manual Name", by: "tarik", at: 5 });
    // a full ingest write
    await t.mutation(internal.media.replaceAssignments, { eventId: 1, assignments: [{ label: "c0:A", name: "Auto Name", source: "legistar", evidenceTurnKey: "0:1" }] });
    await t.mutation(internal.media.replaceChapters, { eventId: 1, chapters: [] });
    expect(await t.query(internal.media.overridesForEvent, { eventId: 1 })).toHaveLength(1);
    const view = await t.query(api.media.meetingView, { eventId: 1 });
    expect(view.turns.map((x) => x.display)).toEqual(["Manual Name", "Speaker A"]);
    expect(JSON.stringify(view)).not.toContain("tarik");
    await expect(t.mutation(internal.media.setOverride, { eventId: 1, label: "c0:B", name: "  ", by: "tarik", at: 6 })).rejects.toThrow();
  });
  it("clear deletes only that override row", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.media.setOverride, { eventId: 1, label: "c0:A", name: "A", by: "tarik", at: 1 });
    await t.mutation(internal.media.setOverride, { eventId: 1, label: "c0:B", name: "B", by: "tarik", at: 1 });
    await t.mutation(internal.media.setOverride, { eventId: 2, label: "c0:A", name: "C", by: "tarik", at: 1 });
    await t.mutation(internal.media.clearOverride, { eventId: 1, label: "c0:A" });
    expect((await t.query(internal.media.overridesForEvent, { eventId: 1 })).map((o) => o.label)).toEqual(["c0:B"]);
    expect(await t.query(internal.media.overridesForEvent, { eventId: 2 })).toHaveLength(1);
  });
});

describe("model decisions", () => {
  it("confirmations are insert-only per key", async () => {
    const t = convexTest(schema, modules);
    const row = { candidateKey: "k", confirm: true, reason: "r1", model: "m", at: 1 };
    await t.mutation(internal.media.recordConfirmations, { eventId: 1, rows: [row] });
    await t.mutation(internal.media.recordConfirmations, { eventId: 1, rows: [{ ...row, confirm: false, reason: "r2" }] });
    expect(await t.query(internal.media.confirmationsForEvent, { eventId: 1 })).toEqual([row]);
  });
  it("chapters are replaced per event only", async () => {
    const t = convexTest(schema, modules);
    const c = { eventItemId: 9, located: "cue" as const, startMs: 1, endMs: 2, parts: [{ kind: "testimony", startMs: 1, endMs: 2 }], partsSource: "model" as const };
    await t.mutation(internal.media.replaceChapters, { eventId: 1, chapters: [c] });
    await t.mutation(internal.media.replaceChapters, { eventId: 2, chapters: [c] });
    await t.mutation(internal.media.replaceChapters, { eventId: 1, chapters: [{ ...c, parts: [], partsSource: "none" }] });
    expect(await t.query(internal.media.chaptersForEvent, { eventId: 1 })).toHaveLength(1);
    expect((await t.query(internal.media.chaptersForEvent, { eventId: 2 }))[0].parts).toHaveLength(1);
  });
});
