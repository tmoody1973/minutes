import { v } from "convex/values";
import { query } from "./_generated/server";
import { NEAR_KINDS } from "./locations";
import { alertMessage } from "../lib/watcher/message";

const WEEK_MS = 7 * 86_400_000;
const MAX_CARDS = 5;

// Public, read-only: "This week at City Hall" for zoning and development files (the same set Near me covers).
// Card text comes from record fields only, worded exactly like Watcher alerts. `now` is passed in (rounded by the
// page) so the result is cacheable and testable.
export const weekAtCityHall = query({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const zoning = new Map<number, { fileNumber: string; title: string }>();
    for (const kind of NEAR_KINDS) {
      for (const m of await ctx.db.query("matterLocations").withIndex("by_kind", (q) => q.eq("kind", kind)).collect()) {
        zoning.set(m.matterId, { fileNumber: m.fileNumber, title: m.title });
      }
    }

    // Coming up: zoning files on an agenda in the next 7 days, soonest first, one card per file.
    // ponytail: scans the events table (a few hundred rows per year); add a startsAt index if it grows.
    const upcoming = (await ctx.db.query("events").collect())
      .filter((e) => {
        const at = Date.parse(e.startsAt);
        return at > now && at <= now + WEEK_MS;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const comingUp = [];
    const seen = new Set<number>();
    for (const ev of upcoming) {
      for (const item of await ctx.db.query("eventItems").withIndex("by_event", (q) => q.eq("eventId", ev.legistarId)).collect()) {
        const m = item.matterId === undefined ? undefined : zoning.get(item.matterId);
        if (!m || item.removedAt !== undefined || seen.has(item.matterId!)) continue;
        seen.add(item.matterId!);
        comingUp.push({ ...alertMessage({ kind: "hearing_scheduled", ...m, bodyName: ev.bodyName, startsAt: ev.startsAt }), at: ev.startsAt });
      }
    }

    // Decided: each zoning file's latest recorded decision in the last 7 days, newest first.
    const decided = [];
    for (const [matterId, m] of zoning) {
      const rows = (await ctx.db.query("histories").withIndex("by_matter", (q) => q.eq("matterId", matterId)).collect()).filter((h) => {
        const at = Date.parse(h.date);
        return h.passed !== undefined && at <= now && at > now - WEEK_MS;
      });
      const latest = rows.sort((a, b) => b.date.localeCompare(a.date))[0];
      if (latest) decided.push({ ...alertMessage({ kind: "decision", ...m, date: latest.date, bodyName: latest.bodyName, actionName: latest.actionName }), at: latest.date });
    }
    decided.sort((a, b) => b.at.localeCompare(a.at));

    return { comingUp: comingUp.slice(0, MAX_CARDS), decided: decided.slice(0, MAX_CARDS) };
  },
});
