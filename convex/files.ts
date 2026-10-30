import { v } from "convex/values";
import { query } from "./_generated/server";
import { buildTimeline } from "../lib/timeline/build";
import type { Tally, TimelineStep } from "../lib/types";

const FILE_NUMBER = /^\d{5,7}$/;

// Public, read-only: everything the project page shows for one Legistar file. The lot owner's name is dropped:
// the page has no use for it and a private person's name should not ride along to every visitor.
export const fileView = query({
  args: { fileNumber: v.string() },
  handler: async (ctx, { fileNumber }) => {
    if (!FILE_NUMBER.test(fileNumber)) throw new Error("file number must be 5 to 7 digits");
    const m = await ctx.db.query("matters").withIndex("by_fileNumber", (q) => q.eq("fileNumber", fileNumber)).first();
    if (!m) return null;
    const histories = await ctx.db.query("histories").withIndex("by_matter", (q) => q.eq("matterId", m.legistarId)).collect();
    const items = await ctx.db.query("eventItems").withIndex("by_matter", (q) => q.eq("matterId", m.legistarId)).collect();
    const eventIds = new Set([...items.map((i) => i.eventId), ...histories.flatMap((h) => (h.eventId === undefined ? [] : [h.eventId]))]);
    const events = [];
    for (const id of eventIds) {
      const ev = await ctx.db.query("events").withIndex("by_legistarId", (q) => q.eq("legistarId", id)).unique();
      if (ev) events.push(ev);
    }
    const tallies = new Map<number, Tally>(items.flatMap((i) => (i.tally ? [[i.legistarId, i.tally] as const] : [])));
    const eventOf = new Map(events.map((e) => [e.legistarId, e]));
    // Each step also carries its meeting's video clip and exact start time (the calendar file needs the time).
    const timeline = buildTimeline(m, histories, items, events, tallies, new Date()).map((s): TimelineStep & { clipId?: number; startsAt?: string } => {
      const ev = s.eventId === undefined ? undefined : eventOf.get(s.eventId);
      if (!ev) return s;
      return { ...s, startsAt: ev.startsAt, ...(ev.clipId !== undefined && { clipId: ev.clipId }) };
    });
    return {
      matter: { legistarId: m.legistarId, fileNumber: m.fileNumber, title: m.title, typeName: m.typeName, statusName: m.statusName },
      timeline,
      histories: [...histories]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((h) => ({ date: h.date, bodyName: h.bodyName, actionName: h.actionName, ...(h.passed !== undefined && { passed: h.passed }) })),
      parcels: (m.parcels ?? []).map((p) => ({
        taxkey: p.taxkey, address: p.address, zoning: p.zoning, alder: p.alder, lotAreaSqFt: p.lotAreaSqFt, polygon: p.polygon, centroid: p.centroid,
      })),
      attachments: m.attachments ?? [],
    };
  },
});
