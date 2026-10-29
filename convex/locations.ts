import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { parseZoningChange } from "../lib/zoning/change";

export const NEAR_KINDS = ["rezoning", "dpd-amendment", "minor-modification"] as const;

/** Make the matterLocations row for one matter match its current title/status/parcels (insert, patch or delete). */
export async function syncMatterLocation(ctx: MutationCtx, matterId: number): Promise<void> {
  const m = await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", matterId)).unique();
  const existing = await ctx.db.query("matterLocations").withIndex("by_matter", (q) => q.eq("matterId", matterId)).unique();
  const kind = m ? parseZoningChange(m.title).kind : "other";
  const centroids = (m?.parcels ?? []).flatMap((p) => (p.centroid ? [p.centroid] : []));
  if (!m || !(NEAR_KINDS as readonly string[]).includes(kind) || !centroids.length) {
    if (existing) await ctx.db.delete(existing._id);
    return;
  }
  const next = { matterId, fileNumber: m.fileNumber, title: m.title, kind, statusName: m.statusName, centroids };
  if (existing) await ctx.db.replace(existing._id, next);
  else await ctx.db.insert("matterLocations", next);
}

// One-off backfill: `npx convex run locations:backfillMatterLocations`, repeating with the returned cursor until done.
export const backfillMatterLocations = internalMutation({
  args: { cursor: v.optional(v.string()), batch: v.optional(v.number()) },
  handler: async (ctx, { cursor, batch }) => {
    const page = await ctx.db.query("matters").paginate({ cursor: cursor ?? null, numItems: batch ?? 50 });
    for (const m of page.page) await syncMatterLocation(ctx, m.legistarId);
    return { done: page.isDone, cursor: page.continueCursor, processed: page.page.length };
  },
});
