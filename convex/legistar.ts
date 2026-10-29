import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { tallyV } from "./schema";

type Upserted = { inserted: boolean; changedFields: string[] };
type LegistarTable = "events" | "eventItems" | "matters" | "histories" | "persons";

// Optional fields this upsert owns: if upstream drops one, we clear it. Deliberately excludes
// fields written by other mutations (eventItems.tally).
const CLEARABLE: Record<LegistarTable, string[]> = {
  events: ["clipId", "agendaUrl", "minutesUrl", "insiteUrl"],
  eventItems: ["matterId", "fileNumber", "actionName", "passed", "videoStartSec", "mover", "seconder"],
  matters: ["introDate", "attachments"],
  histories: ["passed", "eventId"],
  persons: ["bodyId", "role"],
};

// Insert or patch by legistarId. Compares incoming keys plus this table's clearable keys;
// keys that went set -> absent are patched to undefined (unsets the field).
async function upsert(ctx: MutationCtx, table: LegistarTable, rec: Record<string, unknown> & { legistarId: number }) {
  const existing = await ctx.db
    .query(table)
    .withIndex("by_legistarId", (q) => q.eq("legistarId", rec.legistarId))
    .unique();
  if (!existing) {
    const id = await ctx.db.insert(table, rec as never);
    return { id, inserted: true, changedFields: [] as string[] };
  }
  const stored = existing as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(rec), ...CLEARABLE[table]])];
  const changedFields = keys.filter((k) => JSON.stringify(stored[k]) !== JSON.stringify(rec[k]));
  if (changedFields.length) {
    const patch = Object.fromEntries(changedFields.map((k) => [k, rec[k]]));
    await ctx.db.patch(existing._id, patch as never);
  }
  return { id: existing._id, inserted: false, changedFields };
}

// sourceKey is unique: the same real change can never produce a second row.
async function recordChange(
  ctx: MutationCtx,
  c: { kind: "hearing_scheduled" | "decision" | "step_added"; matterId: number; eventId?: number; at: string; sourceKey: string },
) {
  const dup = await ctx.db.query("changes").withIndex("by_sourceKey", (q) => q.eq("sourceKey", c.sourceKey)).first();
  if (!dup) await ctx.db.insert("changes", c);
}

const out = ({ inserted, changedFields }: Upserted & { id?: unknown }): Upserted => ({ inserted, changedFields });

export const upsertEvent = mutation({
  args: {
    legistarId: v.number(),
    bodyId: v.number(),
    bodyName: v.string(),
    startsAt: v.string(),
    clipId: v.optional(v.number()),
    agendaUrl: v.optional(v.string()),
    minutesUrl: v.optional(v.string()),
    insiteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => out(await upsert(ctx, "events", args)),
});

export const upsertEventItem = mutation({
  args: {
    legistarId: v.number(),
    eventId: v.number(),
    sequence: v.union(v.number(), v.null()),
    matterId: v.optional(v.number()),
    fileNumber: v.optional(v.string()),
    title: v.string(),
    actionName: v.optional(v.string()),
    passed: v.optional(v.boolean()),
    videoStartSec: v.optional(v.number()),
    mover: v.optional(v.string()),
    seconder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const r = await upsert(ctx, "eventItems", args);
    // Legistar records a scheduled hearing as a future agenda item, not a history row.
    if (r.inserted && args.matterId !== undefined) {
      const ev = await ctx.db.query("events").withIndex("by_legistarId", (q) => q.eq("legistarId", args.eventId)).unique();
      if (ev && Date.parse(ev.startsAt) > Date.now()) {
        await recordChange(ctx, {
          kind: "hearing_scheduled",
          matterId: args.matterId,
          eventId: args.eventId,
          at: new Date().toISOString(),
          sourceKey: `eventitem:${args.legistarId}`,
        });
      }
    }
    return out(r);
  },
});

export const upsertMatter = mutation({
  args: {
    legistarId: v.number(),
    fileNumber: v.string(),
    title: v.string(),
    typeName: v.string(),
    statusName: v.string(),
    introDate: v.optional(v.string()),
    attachments: v.optional(v.array(v.object({ name: v.string(), hyperlink: v.string() }))),
  },
  handler: async (ctx, args) => out(await upsert(ctx, "matters", args)),
});

export const upsertHistory = mutation({
  args: {
    legistarId: v.number(),
    matterId: v.number(),
    date: v.string(),
    bodyName: v.string(),
    actionName: v.string(),
    passed: v.optional(v.boolean()),
    eventId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const r = await upsert(ctx, "histories", args);
    if (r.inserted) {
      await recordChange(ctx, {
        kind: args.passed !== undefined ? "decision" : "step_added",
        matterId: args.matterId,
        ...(args.eventId !== undefined && { eventId: args.eventId }),
        at: args.date,
        sourceKey: `history:${args.legistarId}`,
      });
    }
    return out(r);
  },
});

export const upsertPerson = mutation({
  args: { legistarId: v.number(), name: v.string(), bodyId: v.optional(v.number()), role: v.optional(v.string()) },
  handler: async (ctx, args) => out(await upsert(ctx, "persons", args)),
});

// Vote-derived person: insert if missing, never overwrite (would clear bodyId/role set from officerecords).
export const ensurePerson = mutation({
  args: { legistarId: v.number(), name: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("persons").withIndex("by_legistarId", (q) => q.eq("legistarId", args.legistarId)).unique();
    if (!row) await ctx.db.insert("persons", args);
  },
});

export const setEventItemTally = mutation({
  args: { eventItemLegistarId: v.number(), tally: tallyV },
  handler: async (ctx, { eventItemLegistarId, tally }) => {
    const row = await ctx.db
      .query("eventItems")
      .withIndex("by_legistarId", (q) => q.eq("legistarId", eventItemLegistarId))
      .unique();
    if (!row) throw new Error(`event item ${eventItemLegistarId} not found`);
    await ctx.db.patch(row._id, { tally });
  },
});

const voteV = v.object({ eventItemId: v.number(), personId: v.number(), personName: v.string(), value: v.string() });

export const replaceVotes = mutation({
  args: { eventItemId: v.number(), votes: v.array(voteV) },
  handler: async (ctx, { eventItemId, votes }): Promise<Upserted> => {
    const old = await ctx.db.query("votes").withIndex("by_eventItem", (q) => q.eq("eventItemId", eventItemId)).collect();
    const key = (x: { personId: number; personName: string; value: string }) => `${x.personId}|${x.personName}|${x.value}`;
    const same = old.length === votes.length && old.map(key).sort().join() === votes.map(key).sort().join();
    if (same) return { inserted: false, changedFields: [] };
    for (const o of old) await ctx.db.delete(o._id);
    for (const vote of votes) await ctx.db.insert("votes", vote);
    return { inserted: old.length === 0, changedFields: ["votes"] };
  },
});

export const recordSyncRun = mutation({
  args: { startedAt: v.number(), finishedAt: v.number(), ok: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.insert("syncRuns", args);
  },
});

export const lastSuccessfulSync = query({
  args: {},
  handler: async (ctx) => {
    const runs = ctx.db.query("syncRuns").withIndex("by_finishedAt").order("desc");
    for await (const r of runs) if (r.ok) return r;
    return null;
  },
});
