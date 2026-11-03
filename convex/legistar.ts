import { type Infer, v } from "convex/values";
import { internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { boxV, parcelV, tallyV } from "./schema";
import { syncMatterLocation } from "./locations";
import { isIntroduction } from "../lib/watcher/match";

type Upserted = { inserted: boolean; changedFields: string[] };
type LegistarTable = "events" | "eventItems" | "matters" | "histories" | "persons";

// Optional fields this upsert owns: if upstream drops one, we clear it. Deliberately excludes
// fields written by other mutations (eventItems.tally).
const CLEARABLE: Record<LegistarTable, string[]> = {
  events: ["clipId", "agendaUrl", "minutesUrl", "insiteUrl"],
  eventItems: ["matterId", "fileNumber", "actionName", "passed", "videoStartSec", "mover", "seconder", "minutesNote", "removedAt"],
  matters: ["introDate", "attachments"],
  histories: ["passed", "eventId"],
  persons: [],
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
  c: { kind: "hearing_scheduled" | "decision" | "introduced" | "step_added"; matterId: number; eventId?: number; at: string; sourceKey: string },
) {
  const dup = await ctx.db.query("changes").withIndex("by_sourceKey", (q) => q.eq("sourceKey", c.sourceKey)).first();
  if (!dup) await ctx.db.insert("changes", c);
}

const out = ({ inserted, changedFields }: Upserted & { id?: unknown }): Upserted => ({ inserted, changedFields });

export const upsertEvent = internalMutation({
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

const eventItemArgs = {
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
    minutesNote: v.optional(v.string()),
  };

async function saveEventItem(ctx: MutationCtx, args: Infer<typeof eventItemV>) {
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
          // One per matter per meeting: a matter listed twice, or on a republished agenda, is still one hearing.
          sourceKey: `hearing:${args.matterId}:${args.eventId}`,
        });
      }
    }
    return out(r);
}

const eventItemV = v.object(eventItemArgs);

export const upsertEventItem = internalMutation({
  args: eventItemArgs,
  handler: (ctx, args) => saveEventItem(ctx, args),
});

// One call per meeting instead of one per agenda item (the sync runs every 30 minutes and nightly since Jan 1).
export const upsertEventItems = internalMutation({
  args: { items: v.array(eventItemV) },
  handler: async (ctx, { items }) => {
    for (const item of items) await saveEventItem(ctx, item);
  },
});

// Marks stored items of an event that upstream no longer lists. Never deletes; keeps the first removedAt.
// An empty list for an event with live items is far likelier a bad Legistar reply than a fully withdrawn agenda,
// so it is refused (the caller records the failure) unless the whole event was dropped from Legistar's list.
export const markEventItemsRemoved = internalMutation({
  args: { eventId: v.number(), presentIds: v.array(v.number()), at: v.number(), eventDropped: v.optional(v.boolean()) },
  handler: async (ctx, { eventId, presentIds, at, eventDropped }) => {
    const present = new Set(presentIds);
    const rows = await ctx.db.query("eventItems").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect();
    const live = rows.filter((r) => r.removedAt === undefined).length;
    if (!presentIds.length && live && !eventDropped) {
      throw new Error(`Legistar returned no items for event ${eventId} but ${live} are stored; removals skipped`);
    }
    for (const r of rows) if (!present.has(r.legistarId) && r.removedAt === undefined) await ctx.db.patch(r._id, { removedAt: at });
  },
});

export const upsertMatter = internalMutation({
  args: {
    legistarId: v.number(),
    fileNumber: v.string(),
    title: v.string(),
    typeName: v.string(),
    statusName: v.string(),
    introDate: v.optional(v.string()),
    attachments: v.optional(v.array(v.object({ name: v.string(), hyperlink: v.string() }))),
  },
  handler: async (ctx, args) => {
    const r = out(await upsert(ctx, "matters", args));
    await syncMatterLocation(ctx, args.legistarId);
    return r;
  },
});

// parcels has its own writer: it is not in CLEARABLE, so a matter upsert that doesn't carry it leaves it alone.
export const setMatterParcels = internalMutation({
  // parcels omitted = clear the field (the title no longer names any address).
  args: { matterId: v.number(), parcels: v.optional(v.array(parcelV)) },
  handler: async (ctx, { matterId, parcels }) => {
    const row = await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", matterId)).unique();
    if (row) await ctx.db.patch(row._id, { parcels, parcelsCheckedAt: Date.now() });
    await syncMatterLocation(ctx, matterId);
  },
});

export const matterParcelsCheckedAt = internalQuery({
  args: { matterId: v.number() },
  handler: async (ctx, { matterId }) =>
    (await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", matterId)).unique())?.parcelsCheckedAt ?? null,
});

// Stored events in a sync window for the requested bodies (ids only), for spotting meetings Legistar dropped.
export const eventIdsInWindow = internalQuery({
  args: { since: v.string(), until: v.string(), bodyIds: v.array(v.number()) },
  handler: async (ctx, { since, until, bodyIds }) =>
    (await ctx.db.query("events").collect())
      .filter((e) => bodyIds.includes(e.bodyId) && e.startsAt.slice(0, 10) >= since && e.startsAt.slice(0, 10) <= until)
      .map((e) => e.legistarId),
});

export const getMatterParcels = internalQuery({
  args: { matterId: v.number() },
  handler: async (ctx, { matterId }) =>
    (await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", matterId)).unique())?.parcels ?? null,
});

export const getMatterByFileNumber = internalQuery({
  args: { fileNumber: v.string() },
  handler: async (ctx, { fileNumber }) =>
    (await ctx.db.query("matters").withIndex("by_fileNumber", (q) => q.eq("fileNumber", fileNumber)).first()) ?? null,
});

export const setExhibitCheck = internalMutation({
  args: {
    fileNumber: v.string(),
    noConflict: v.boolean(),
    iou: v.number(),
    method: v.literal("outline-point"),
    colorBox: v.union(boxV, v.null()),
    samBox: v.union(boxV, v.null()),
    reason: v.optional(v.union(v.literal("no-color-box"), v.literal("sam-no-match"))),
    checkedAt: v.number(),
  },
  handler: async (ctx, { fileNumber, ...exhibitCheck }) => {
    const row = await ctx.db.query("matters").filter((q) => q.eq(q.field("fileNumber"), fileNumber)).first();
    if (!row) throw new Error(`no matter with file number ${fileNumber}`);
    await ctx.db.patch(row._id, { exhibitCheck }); // patch replaces the whole nested object, so no stale legacy fields survive
  },
});

export const matterSyncedAt = internalQuery({
  args: { matterId: v.number() },
  handler: async (ctx, { matterId }) =>
    (await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", matterId)).unique())?.syncedAt ?? null,
});

export const markMatterSynced = internalMutation({
  args: { matterId: v.number(), at: v.number() },
  handler: async (ctx, { matterId, at }) => {
    const row = await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", matterId)).unique();
    if (row) await ctx.db.patch(row._id, { syncedAt: at });
  },
});

const historyArgs = {
    legistarId: v.number(),
    matterId: v.number(),
    date: v.string(),
    bodyName: v.string(),
    actionName: v.string(),
    passed: v.optional(v.boolean()),
    eventId: v.optional(v.number()),
  };
const historyV = v.object(historyArgs);

async function saveHistory(ctx: MutationCtx, args: Infer<typeof historyV>) {
    const r = await upsert(ctx, "histories", args);
    if (r.inserted) {
      await recordChange(ctx, {
        kind: args.passed !== undefined ? "decision" : isIntroduction(args.actionName) ? "introduced" : "step_added",
        matterId: args.matterId,
        ...(args.eventId !== undefined && { eventId: args.eventId }),
        at: args.date,
        sourceKey: `history:${args.legistarId}`,
      });
    }
    return out(r);
}

export const upsertHistory = internalMutation({
  args: historyArgs,
  handler: (ctx, args) => saveHistory(ctx, args),
});

// One call per matter instead of one per history row.
export const upsertHistories = internalMutation({
  args: { rows: v.array(historyV) },
  handler: async (ctx, { rows }) => {
    for (const row of rows) await saveHistory(ctx, row);
  },
});

export const upsertPerson = internalMutation({
  args: { legistarId: v.number(), name: v.string() },
  handler: async (ctx, args) => out(await upsert(ctx, "persons", args)),
});

// Keyed on (personId, bodyId); a person can hold seats on several bodies.
export const upsertMembership = internalMutation({
  args: { personId: v.number(), bodyId: v.number(), role: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("memberships").withIndex("by_person", (q) => q.eq("personId", args.personId)).collect();
    const row = rows.find((r) => r.bodyId === args.bodyId);
    if (!row) return void (await ctx.db.insert("memberships", args));
    if (row.role !== args.role) await ctx.db.patch(row._id, { role: args.role });
  },
});

export const setEventItemTally = internalMutation({
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

// One call per voted agenda item: voters' names, the votes and the tally together (was one call per voter plus
// two). Names and tally are written only when they changed, so an unchanged item writes nothing.
export const saveVotes = internalMutation({
  args: { eventItemId: v.number(), votes: v.array(voteV), tally: tallyV },
  handler: async (ctx, { eventItemId, votes, tally }) => {
    const people = new Map(votes.map((x) => [x.personId, x.personName]));
    for (const [legistarId, name] of people) await upsert(ctx, "persons", { legistarId, name });
    const old = await ctx.db.query("votes").withIndex("by_eventItem", (q) => q.eq("eventItemId", eventItemId)).collect();
    const key = (x: { personId: number; personName: string; value: string }) => `${x.personId}|${x.personName}|${x.value}`;
    if (!(old.length === votes.length && old.map(key).sort().join() === votes.map(key).sort().join())) {
      for (const o of old) await ctx.db.delete(o._id);
      for (const vote of votes) await ctx.db.insert("votes", vote);
    }
    const row = await ctx.db.query("eventItems").withIndex("by_legistarId", (q) => q.eq("legistarId", eventItemId)).unique();
    if (!row) throw new Error(`event item ${eventItemId} not found`);
    const t = row.tally;
    if (!t || t.aye !== tally.aye || t.no !== tally.no || t.excused !== tally.excused || t.other !== tally.other) await ctx.db.patch(row._id, { tally });
  },
});

export const replaceVotes = internalMutation({
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

export const recordSyncRun = internalMutation({
  args: { startedAt: v.number(), finishedAt: v.number(), ok: v.boolean(), error: v.optional(v.string()), scope: v.union(v.literal("top"), v.literal("child")) },
  handler: async (ctx, args) => {
    await ctx.db.insert("syncRuns", args);
  },
});

export const lastSuccessfulSync = query({
  args: {},
  handler: async (ctx) => {
    const runs = ctx.db.query("syncRuns").withIndex("by_finishedAt").order("desc");
    for await (const r of runs) if (r.ok && r.scope === "top") return r;
    return null;
  },
});

// Speaker roster for a body: memberships joined to persons. Read-only.
export const rosterForBody = internalQuery({
  args: { bodyId: v.number() },
  handler: async (ctx, { bodyId }) => {
    const members = await ctx.db.query("memberships").withIndex("by_body", (q) => q.eq("bodyId", bodyId)).collect();
    const out: { personId: number; name: string; role?: string }[] = [];
    for (const m of members) {
      const p = await ctx.db.query("persons").withIndex("by_legistarId", (q) => q.eq("legistarId", m.personId)).unique();
      if (p) out.push({ personId: m.personId, name: p.name, ...(m.role ? { role: m.role } : {}) });
    }
    return out;
  },
});
