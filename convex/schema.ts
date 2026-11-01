import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Field names mirror lib/types.ts (the source of truth).
export const tallyV = v.object({ aye: v.number(), no: v.number(), excused: v.number(), other: v.number() });

// One lot named in a matter title. Unknown MPROP values are null (never 0 / ""). Shared with legistar.ts.
export const parcelV = v.object({
  taxkey: v.string(),
  address: v.string(),
  zoning: v.union(v.string(), v.null()),
  alder: v.union(v.number(), v.null()),
  lotAreaSqFt: v.union(v.number(), v.null()),
  owner: v.union(v.string(), v.null()),
  polygon: v.union(v.any(), v.null()),
  centroid: v.union(v.object({ lat: v.number(), lng: v.number() }), v.null()),
});

export const boxV = v.object({ x1: v.number(), y1: v.number(), x2: v.number(), y2: v.number() });

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
    minutesNote: v.optional(v.string()),
    tally: v.optional(tallyV),
    // ms timestamp when upstream stopped listing this item on the agenda; cleared if it reappears.
    removedAt: v.optional(v.number()),
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
    // Lots named in the title, from MPROP + the city parcel map. Unset = title has no addresses (or never looked up);
    // [] = addresses exist but none resolved to a lot. Written only by setMatterParcels, never by upsertMatter.
    parcels: v.optional(v.array(parcelV)),
    // ms epoch of the last completed parcel resolve (success or all addresses skipped); unset = never looked up.
    // Written only by setMatterParcels. syncMatter resolves again only on a title change or when this is over 7 days old.
    parcelsCheckedAt: v.optional(v.number()),
    // Point-prompted SAM check of the exhibit map's "Subject Site" outline against the color-detected one. It records
    // whether the two conflict; it never changes what is drawn. Written only by setExhibitCheck (replaced whole each run).
    // `agrees` is the legacy field from the first (box-prompted, circular) version: kept so old rows validate, never written.
    exhibitCheck: v.optional(v.object({
      agrees: v.optional(v.boolean()),
      noConflict: v.optional(v.boolean()),
      iou: v.number(),
      method: v.optional(v.union(v.literal("point-prompt"), v.literal("outline-point"))),
      colorBox: v.optional(v.union(boxV, v.null())),
      samBox: v.optional(v.union(boxV, v.null())),
      reason: v.optional(v.union(v.literal("no-color-box"), v.literal("sam-no-match"))),
      checkedAt: v.number(),
    })),
  })
    .index("by_legistarId", ["legistarId"])
    .index("by_fileNumber", ["fileNumber"]),
  // Slim read model for near-me: one row per zoning-kind matter that has at least one parcel centroid.
  // Maintained by upsertMatter / setMatterParcels (convex/locations.ts); no polygons, so reads stay small.
  matterLocations: defineTable({
    matterId: v.number(),
    fileNumber: v.string(),
    title: v.string(),
    kind: v.string(),
    statusName: v.string(),
    centroids: v.array(v.object({ lat: v.number(), lng: v.number() })),
  })
    .index("by_kind", ["kind"])
    .index("by_matter", ["matterId"]),
  // Global fixed-window counters (key = what is limited).
  rateLimits: defineTable({ key: v.string(), windowStart: v.number(), count: v.number() }).index("by_key", ["key"]),
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
    .index("by_matter", ["matterId"])
    // This week's "decided" list reads only the last 7 days of rows.
    .index("by_date", ["date"]),
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
  // ---- Milestone 6: accounts, follows and the Watcher (userId = Clerk tokenIdentifier) ----
  users: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    // Set by the unsubscribe link in every alert email; on-site alerts continue.
    emailOff: v.optional(v.boolean()),
    unsubscribeToken: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_unsubscribeToken", ["unsubscribeToken"]),
  // value: file number; "lat,lng" rounded to ~100 m for an address (never the typed text); district number; topic words.
  follows: defineTable({
    userId: v.string(),
    kind: v.union(v.literal("file"), v.literal("address"), v.literal("alder"), v.literal("topic")),
    value: v.string(),
    label: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_kind_value", ["userId", "kind", "value"]),
  // At most one alert per real change per user (lookup on userId + sourceKey before insert).
  alerts: defineTable({
    userId: v.string(),
    sourceKey: v.string(),
    matterId: v.number(),
    changeKind: v.union(v.literal("hearing_scheduled"), v.literal("decision"), v.literal("step_added")),
    message: v.string(),
    href: v.string(),
    createdAt: v.number(),
    replay: v.boolean(),
    // When this replays a real past change: that change's date (shown as "Replay of a real alert from {date}").
    replayOf: v.optional(v.string()),
    emailedAt: v.optional(v.number()),
  })
    .index("by_user_source", ["userId", "sourceKey"])
    .index("by_userId", ["userId"]),
  activityLog: defineTable({ userId: v.string(), at: v.number(), text: v.string() }).index("by_userId", ["userId"]),
  // Single row: the _creationTime of the last change the Watcher has read.
  watcherState: defineTable({ key: v.literal("cursor"), changesThrough: v.number() }).index("by_key", ["key"]),
  // ---- Milestone 3: derived meeting data (ids are Legistar ids) ----
  turns: defineTable({
    eventId: v.number(),
    turnKey: v.string(),
    chunk: v.number(),
    startMs: v.number(),
    endMs: v.number(),
    label: v.optional(v.string()),
    text: v.string(),
    source: v.union(v.literal("transcript"), v.literal("captions")),
  })
    .index("by_event", ["eventId", "startMs"])
    .index("by_event_turnKey", ["eventId", "turnKey"]),
  speakerAssignments: defineTable({
    eventId: v.number(),
    label: v.string(),
    name: v.string(),
    personId: v.optional(v.number()),
    source: v.union(v.literal("legistar"), v.literal("self-intro"), v.literal("manual")),
    evidenceTurnKey: v.string(),
  }).index("by_event", ["eventId"]),
  // Human decisions: never touched by ingest.
  speakerOverrides: defineTable({ eventId: v.number(), label: v.string(), name: v.string(), hidden: v.optional(v.boolean()), by: v.string(), at: v.number() }).index(
    "by_event_label",
    ["eventId", "label"],
  ),
  // Model decisions (Muse Spark confirm/reject), reused on re-ingest. candidateKey = `${label}|${name}|${evidenceTurnKey}`.
  speakerConfirmations: defineTable({
    eventId: v.number(),
    candidateKey: v.string(),
    confirm: v.boolean(),
    reason: v.string(),
    model: v.string(),
    at: v.number(),
  }).index("by_event_candidate", ["eventId", "candidateKey"]),
  chapters: defineTable({
    eventId: v.number(),
    eventItemId: v.number(),
    startMs: v.optional(v.number()),
    endMs: v.optional(v.number()),
    located: v.union(v.literal("video-index"), v.literal("cue"), v.literal("not-located")),
    parts: v.array(v.object({ kind: v.string(), startMs: v.number(), endMs: v.number() })),
    // "model" = Chapterer parts stored (reusable); "none" = model returned nothing valid (reusable); absent = not attempted.
    partsSource: v.optional(v.union(v.literal("model"), v.literal("none"))),
    partsReason: v.optional(v.string()),
    // Hash of the speaker names the Chapterer saw; parts are reused only while it is unchanged.
    namesFingerprint: v.optional(v.string()),
  }).index("by_event", ["eventId"]),
  syncRuns: defineTable({
    startedAt: v.number(),
    finishedAt: v.number(),
    ok: v.boolean(),
    error: v.optional(v.string()),
    // "top" = entry-point run (ok means scheduled); "child" = fan-out job, written only on failure.
    scope: v.union(v.literal("top"), v.literal("child")),
  }).index("by_finishedAt", ["finishedAt"]),
  // ---- Milestone 7: Clerk cards and the Editor ----
  // Only Editor-approved sentences are stored. key = file number, or "eventId:eventItemId" for a chapter.
  cards: defineTable({
    kind: v.union(v.literal("file"), v.literal("chapter")),
    key: v.string(),
    // Hash of the records the card was written from; the writer skips a card whose records have not changed.
    sourcesHash: v.string(),
    sentences: v.array(v.object({ text: v.string(), sourceKeys: v.array(v.string()) })),
    sourceLabels: v.record(v.string(), v.string()),
    writtenAt: v.number(),
  }).index("by_kind_key", ["kind", "key"]),
  // Every verdict, pass or fail, for the rejection-rate metric.
  editorLog: defineTable({
    cardKind: v.union(v.literal("file"), v.literal("chapter")),
    cardKey: v.string(),
    text: v.string(),
    sourceKeys: v.array(v.string()),
    ok: v.boolean(),
    reason: v.optional(v.string()),
    detail: v.optional(v.string()),
    at: v.number(),
  }).index("by_card", ["cardKind", "cardKey"]),
});
