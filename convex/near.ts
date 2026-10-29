import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { distanceMiles, geocodeUserAddress } from "../lib/geo/near";
import { parseZoningChange } from "../lib/zoning/change";

const KINDS = new Set(["rezoning", "dpd-amendment", "minor-modification"]);
// Legistar statusName values that mean the file is finished. Real dev values seen: "Passed", "Placed On File",
// "In Council-Placed on File". Pending council steps ("In Council-Adoption"), "Confirmed" and "Dead" are NOT listed:
// they appear under "all" only.
const DECIDED_RE = /^(?:in council-)?(?:passed|adopted|approved|failed|placed on file)$/i;
const MAX_ROWS = 100;

// Public: geocodes a typed address. Not logged. Anyone can call it, so it spends our Census goodwill;
// add a rate limit before launch (Convex has no built-in per-IP limit).
export const geocode = action({
  args: { text: v.string() },
  handler: async (_ctx, { text }) => geocodeUserAddress(text),
});

// Public, read-only. Scans every matter once (~1,000 today, O(n)); the only per-row lookups are indexed reads for
// matters already inside the radius. Ceiling: each matter row carries its parcel polygons, so this reads all of
// them; if the table grows past a few thousand, store a centroid-only side table.
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
    for (const m of await ctx.db.query("matters").collect()) {
      if (!m.parcels?.length || !KINDS.has(parseZoningChange(m.title).kind)) continue;
      const ds = m.parcels.flatMap((p) => (p.centroid ? [distanceMiles(here, p.centroid)] : []));
      if (!ds.length) continue;
      const d = Math.min(...ds);
      if (d <= radiusMi) near.push({ m, d });
    }
    near.sort((a, b) => a.d - b.d);
    const now = Date.now();
    const rows = [];
    for (const { m, d } of near) {
      if (filter === "decided" && !DECIDED_RE.test(m.statusName)) continue;
      let next: { date: string; body: string; eventId: number; at: number } | undefined;
      for (const it of await ctx.db.query("eventItems").withIndex("by_matter", (q) => q.eq("matterId", m.legistarId)).collect()) {
        if (it.removedAt !== undefined) continue;
        const ev = await ctx.db.query("events").withIndex("by_legistarId", (q) => q.eq("legistarId", it.eventId)).unique();
        const at = ev ? Date.parse(ev.startsAt) : NaN;
        if (ev && at > now && (!next || at < next.at)) next = { date: ev.startsAt, body: ev.bodyName, eventId: ev.legistarId, at };
      }
      if (filter === "upcoming" && !next) continue;
      rows.push({
        matterId: m.legistarId,
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
