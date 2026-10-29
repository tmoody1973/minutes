import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { nameSpeakers } from "../lib/media/speakers";
import type { SpeakerAssignment, Turn } from "../lib/types";

const turnV = v.object({
  turnKey: v.string(),
  chunk: v.number(),
  startMs: v.number(),
  endMs: v.number(),
  label: v.optional(v.string()),
  text: v.string(),
  source: v.union(v.literal("transcript"), v.literal("captions")),
});
const assignmentV = v.object({
  label: v.string(),
  name: v.string(),
  personId: v.optional(v.number()),
  source: v.union(v.literal("legistar"), v.literal("self-intro"), v.literal("manual")),
  evidenceTurnKey: v.string(),
});
const chapterV = v.object({
  eventItemId: v.number(),
  startMs: v.optional(v.number()),
  endMs: v.optional(v.number()),
  located: v.union(v.literal("video-index"), v.literal("cue"), v.literal("not-located")),
  parts: v.array(v.object({ kind: v.string(), startMs: v.number(), endMs: v.number() })),
  partsSource: v.optional(v.union(v.literal("model"), v.literal("none"))),
  partsReason: v.optional(v.string()),
});

// ---- writes (internal; called by scripts/ingest-meeting.ts via `npx convex run`) ----

// Upsert one batch of an event's turns by (eventId, turnKey).
export const upsertTurns = internalMutation({
  args: { eventId: v.number(), turns: v.array(turnV) },
  handler: async (ctx, { eventId, turns }) => {
    let inserted = 0;
    for (const t of turns) {
      const row = await ctx.db.query("turns").withIndex("by_event_turnKey", (q) => q.eq("eventId", eventId).eq("turnKey", t.turnKey)).unique();
      if (!row) {
        await ctx.db.insert("turns", { eventId, ...t });
        inserted++;
      } else if (JSON.stringify(row.label) !== JSON.stringify(t.label) || row.text !== t.text || row.startMs !== t.startMs || row.endMs !== t.endMs || row.source !== t.source || row.chunk !== t.chunk) {
        await ctx.db.replace(row._id, { eventId, ...t });
      }
    }
    return { inserted };
  },
});

// Remove THIS event's turns with the given keys (stale after a full write). Other events are untouched.
export const removeTurns = internalMutation({
  args: { eventId: v.number(), turnKeys: v.array(v.string()) },
  handler: async (ctx, { eventId, turnKeys }) => {
    for (const k of turnKeys) {
      const row = await ctx.db.query("turns").withIndex("by_event_turnKey", (q) => q.eq("eventId", eventId).eq("turnKey", k)).unique();
      if (row) await ctx.db.delete(row._id);
    }
    return { removed: turnKeys.length };
  },
});

export const replaceAssignments = internalMutation({
  args: { eventId: v.number(), assignments: v.array(assignmentV) },
  handler: async (ctx, { eventId, assignments }) => {
    for (const r of await ctx.db.query("speakerAssignments").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect()) await ctx.db.delete(r._id);
    for (const a of assignments) await ctx.db.insert("speakerAssignments", { eventId, ...a });
  },
});

export const replaceChapters = internalMutation({
  args: { eventId: v.number(), chapters: v.array(chapterV) },
  handler: async (ctx, { eventId, chapters }) => {
    for (const r of await ctx.db.query("chapters").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect()) await ctx.db.delete(r._id);
    for (const c of chapters) await ctx.db.insert("chapters", { eventId, ...c });
  },
});

// Insert-only per candidateKey: an existing verdict is never overwritten.
export const recordConfirmations = internalMutation({
  args: {
    eventId: v.number(),
    rows: v.array(v.object({ candidateKey: v.string(), confirm: v.boolean(), reason: v.string(), model: v.string(), at: v.number() })),
  },
  handler: async (ctx, { eventId, rows }) => {
    for (const r of rows) {
      const dup = await ctx.db.query("speakerConfirmations").withIndex("by_event_candidate", (q) => q.eq("eventId", eventId).eq("candidateKey", r.candidateKey)).first();
      if (!dup) await ctx.db.insert("speakerConfirmations", { eventId, ...r });
    }
  },
});

export const setOverride = internalMutation({
  args: { eventId: v.number(), label: v.string(), name: v.string(), by: v.string(), at: v.number() },
  handler: async (ctx, a) => {
    const name = a.name.trim();
    if (!name) throw new Error("override name must not be empty");
    const row = await ctx.db.query("speakerOverrides").withIndex("by_event_label", (q) => q.eq("eventId", a.eventId).eq("label", a.label)).first();
    if (row) await ctx.db.replace(row._id, { ...a, name });
    else await ctx.db.insert("speakerOverrides", { ...a, name });
  },
});

// Deletes only that (event, label) override row.
export const clearOverride = internalMutation({
  args: { eventId: v.number(), label: v.string() },
  handler: async (ctx, { eventId, label }) => {
    const rows = await ctx.db.query("speakerOverrides").withIndex("by_event_label", (q) => q.eq("eventId", eventId).eq("label", label)).collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return { cleared: rows.length };
  },
});

// ---- internal reads for scripts ----

export const eventByLegistarId = internalQuery({
  args: { legistarId: v.number() },
  handler: async (ctx, { legistarId }) => {
    const e = await ctx.db.query("events").withIndex("by_legistarId", (q) => q.eq("legistarId", legistarId)).unique();
    return e && { legistarId: e.legistarId, bodyId: e.bodyId, clipId: e.clipId ?? null };
  },
});

export const itemsForEvent = internalQuery({
  args: { eventId: v.number() },
  handler: async (ctx, { eventId }) => {
    const items = await ctx.db.query("eventItems").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect();
    return items.map(({ _id, _creationTime, ...i }) => i);
  },
});

export const turnKeysForEvent = internalQuery({
  args: { eventId: v.number() },
  handler: async (ctx, { eventId }) => (await ctx.db.query("turns").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect()).map((t) => t.turnKey),
});

export const confirmationsForEvent = internalQuery({
  args: { eventId: v.number() },
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db.query("speakerConfirmations").withIndex("by_event_candidate", (q) => q.eq("eventId", eventId)).collect();
    return rows.map(({ _id, _creationTime, eventId: _e, ...r }) => r);
  },
});

export const chaptersForEvent = internalQuery({
  args: { eventId: v.number() },
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db.query("chapters").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect();
    return rows.map(({ _id, _creationTime, eventId: _e, ...r }) => r);
  },
});

export const assignmentsForEvent = internalQuery({
  args: { eventId: v.number() },
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db.query("speakerAssignments").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect();
    return rows.map(({ _id, _creationTime, eventId: _e, ...r }) => r);
  },
});

export const overridesForEvent = internalQuery({
  args: { eventId: v.number() },
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db.query("speakerOverrides").withIndex("by_event_label", (q) => q.eq("eventId", eventId)).collect();
    return rows.map(({ _id, _creationTime, eventId: _e, ...r }) => r);
  },
});

// ---- public read ----

// Read-only. Overrides apply here (as manual assignments); their `by` field is never returned.
export const meetingView = query({
  args: { eventId: v.number() },
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db.query("turns").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect();
    const assignments = await ctx.db.query("speakerAssignments").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect();
    const overrides = await ctx.db.query("speakerOverrides").withIndex("by_event_label", (q) => q.eq("eventId", eventId)).collect();
    const turns: Turn[] = rows.map((t) => ({ eventId, turnKey: t.turnKey, chunk: t.chunk, startMs: t.startMs, endMs: t.endMs, label: t.label ?? null, text: t.text }));
    const accepted: SpeakerAssignment[] = [
      ...assignments.map((a) => ({ label: a.label, name: a.name, source: a.source, evidenceTurnKey: a.evidenceTurnKey, ...(a.personId !== undefined ? { personId: a.personId } : {}) })),
      ...overrides.map((o) => ({ label: o.label, name: o.name, source: "manual" as const, evidenceTurnKey: "", at: o.at })),
    ];
    const names = new Map(nameSpeakers(turns, accepted).map((n) => [n.turnKey, n]));
    const chapters = await ctx.db.query("chapters").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect();
    return {
      turns: turns.map((t) => ({ turnKey: t.turnKey, startMs: t.startMs, endMs: t.endMs, text: t.text, label: t.label, display: names.get(t.turnKey)!.display, asHeard: names.get(t.turnKey)!.asHeard })),
      chapters: chapters.map((c) => ({ eventItemId: c.eventItemId, startMs: c.startMs ?? null, endMs: c.endMs ?? null, located: c.located, parts: c.parts })),
    };
  },
});
