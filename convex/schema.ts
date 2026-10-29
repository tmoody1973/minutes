import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Field names mirror lib/types.ts (the source of truth).
export const tallyV = v.object({ aye: v.number(), no: v.number(), excused: v.number(), other: v.number() });

export default defineSchema({
  bodies: defineTable({ legistarId: v.number(), name: v.string() }).index("by_legistarId", ["legistarId"]),
  events: defineTable({
    legistarId: v.number(),
    bodyId: v.number(),
    bodyName: v.string(),
    startsAt: v.string(),
    clipId: v.optional(v.number()),
    agendaUrl: v.optional(v.string()),
    minutesUrl: v.optional(v.string()),
    insiteUrl: v.optional(v.string()),
  }).index("by_legistarId", ["legistarId"]),
  eventItems: defineTable({
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
    tally: v.optional(tallyV),
  })
    .index("by_legistarId", ["legistarId"])
    .index("by_event", ["eventId"])
    .index("by_matter", ["matterId"]),
  matters: defineTable({
    legistarId: v.number(),
    fileNumber: v.string(),
    title: v.string(),
    typeName: v.string(),
    statusName: v.string(),
    introDate: v.optional(v.string()),
    // ms timestamp of the last complete syncMatter; lets frequent runs skip fresh matters.
    syncedAt: v.optional(v.number()),
    // Exhibit list (name + hyperlink) from matters/{id}/attachments; Milestone 2 reads exhibit maps from it.
    attachments: v.optional(v.array(v.object({ name: v.string(), hyperlink: v.string() }))),
  }).index("by_legistarId", ["legistarId"]),
  histories: defineTable({
    legistarId: v.number(),
    matterId: v.number(),
    date: v.string(),
    bodyName: v.string(),
    actionName: v.string(),
    passed: v.optional(v.boolean()),
    eventId: v.optional(v.number()),
  })
    .index("by_legistarId", ["legistarId"])
    .index("by_matter", ["matterId"]),
  votes: defineTable({
    eventItemId: v.number(),
    personId: v.number(),
    personName: v.string(),
    value: v.string(),
  }).index("by_eventItem", ["eventItemId"]),
  persons: defineTable({ legistarId: v.number(), name: v.string() }).index("by_legistarId", ["legistarId"]),
  // One row per (person, body): people sit on several bodies, so this is not a field on persons.
  memberships: defineTable({ personId: v.number(), bodyId: v.number(), role: v.optional(v.string()) })
    .index("by_body", ["bodyId"])
    .index("by_person", ["personId"]),
  changes: defineTable({
    kind: v.union(v.literal("hearing_scheduled"), v.literal("decision"), v.literal("step_added")),
    matterId: v.number(),
    eventId: v.optional(v.number()),
    at: v.string(),
    sourceKey: v.string(),
  })
    .index("by_sourceKey", ["sourceKey"])
    .index("by_matter", ["matterId"]),
  syncRuns: defineTable({
    startedAt: v.number(),
    finishedAt: v.number(),
    ok: v.boolean(),
    error: v.optional(v.string()),
    // "top" = entry-point run (ok means scheduled); "child" = fan-out job, written only on failure.
    scope: v.union(v.literal("top"), v.literal("child")),
  }).index("by_finishedAt", ["finishedAt"]),
});
