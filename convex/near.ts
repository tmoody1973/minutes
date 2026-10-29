import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";
import { NEAR_KINDS } from "./locations";
import { distanceMiles, geocodeUserAddress, MAX_GEOCODE_INPUT } from "../lib/geo/near";

// Legistar statusName values that mean the file is finished. Real dev values seen: "Passed", "Placed On File",
// "In Council-Placed on File". Pending council steps ("In Council-Adoption"), "Confirmed" and "Dead" are NOT listed:
// they appear under "all" only.
const DECIDED_RE = /^(?:in council-)?(?:passed|adopted|approved|failed|placed on file)$/i;
const MAX_ROWS = 100;
const RECENT_MS = 7 * 86_400_000;

const GEOCODE_LIMIT = 60;
const WINDOW_MS = 60_000;

// Global fixed window (not per user: the action has no caller identity). Returns false when the window is spent.
export const takeGeocodeToken = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, { now = Date.now() }) => {
    const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
    const row = await ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", "geocode")).unique();
    if (!row) {
      await ctx.db.insert("rateLimits", { key: "geocode", windowStart, count: 1 });
      return true;
    }
    if (row.windowStart < windowStart) {
      await ctx.db.patch(row._id, { windowStart, count: 1 });
      return true;
    }
    if (row.count >= GEOCODE_LIMIT) return false;
    await ctx.db.patch(row._id, { count: row.count + 1 });
    return true;
  },
});

// Public: geocodes a typed address (never logged), at most 60 per minute across all callers; over that -> "busy".
export const geocode = action({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    // Bad input costs nothing: refuse it before it takes a rate-limit token.
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_GEOCODE_INPUT) return { error: "not-found" as const };
    if (!(await ctx.runMutation(internal.near.takeGeocodeToken, {}))) return { error: "busy" as const };
    return geocodeUserAddress(text);
  },
});

// Public, read-only. Reads only matterLocations rows of the three zoning kinds (slim: centroids, no polygons; never
// the matters table), then indexed event lookups for rows already inside the radius. Capped at 100 rows.
export const filesNear = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusMi: v.optional(v.number()),
    filter: v.union(v.literal("upcoming"), v.literal("decided"), v.literal("all")),
  },
  handler: async (ctx, { lat, lng, radiusMi = 0.5, filter }) => {
    if (!(lat >= -90 && lat <= 90)) throw new Error("lat must be between -90 and 90");
    if (!(lng >= -180 && lng <= 180)) throw new Error("lng must be between -180 and 180");
    if (!(radiusMi > 0 && radiusMi <= 5)) throw new Error("radiusMi must be greater than 0 and at most 5");
    const here = { lat, lng };
    const near = [];
    for (const kind of NEAR_KINDS) {
      for (const m of await ctx.db.query("matterLocations").withIndex("by_kind", (q) => q.eq("kind", kind)).collect()) {
        const d = Math.min(...m.centroids.map((c) => distanceMiles(here, c)));
        if (d <= radiusMi) near.push({ m, d });
      }
    }
    near.sort((a, b) => a.d - b.d);
    const now = Date.now();
    const rows = [];
    for (const { m, d } of near) {
      if (filter === "decided" && !DECIDED_RE.test(m.statusName)) continue;
      let next: { date: string; body: string; eventId: number; at: number } | undefined;
      let onAgenda = false; // a non-removed item at a meeting in the last 7 days: the hearing may still be in progress
      for (const it of await ctx.db.query("eventItems").withIndex("by_matter", (q) => q.eq("matterId", m.matterId)).collect()) {
        if (it.removedAt !== undefined) continue;
        const ev = await ctx.db.query("events").withIndex("by_legistarId", (q) => q.eq("legistarId", it.eventId)).unique();
        const at = ev ? Date.parse(ev.startsAt) : NaN;
        if (ev && at > now && (!next || at < next.at)) next = { date: ev.startsAt, body: ev.bodyName, eventId: ev.legistarId, at };
        if (ev && at <= now && at > now - RECENT_MS) onAgenda = true;
      }
      if (filter === "upcoming" && !next && !onAgenda) continue;
      rows.push({
        matterId: m.matterId,
        fileNumber: m.fileNumber,
        title: m.title,
        statusName: m.statusName,
        distanceMi: Math.round(d * 100) / 100,
        ...(next && { nextHearing: { date: next.date, body: next.body, eventId: next.eventId } }),
      });
      if (rows.length >= MAX_ROWS) break;
    }
    return rows;
  },
});
