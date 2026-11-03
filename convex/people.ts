import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import { districtOf, memberName, sortMembers, type Member } from "../lib/ui/people";

// Legistar's Common Council body; its seat titles name each alder's district.
const COUNCIL_BODY_ID = 1;

async function councilDistricts(ctx: QueryCtx): Promise<Map<number, number>> {
  const seats = await ctx.db.query("memberships").withIndex("by_body", (q) => q.eq("bodyId", COUNCIL_BODY_ID)).collect();
  return new Map(seats.flatMap((s) => {
    const d = districtOf(s.role);
    return d === null ? [] : [[s.personId, d] as const];
  }));
}

// Public, read-only: who sits on the body holding a meeting, so a resident knows whom to contact before it decides.
// Current members per the city's office records (synced nightly), not necessarily who sat on past meetings.
export const whoDecides = query({
  args: { eventId: v.number() },
  handler: async (ctx, { eventId }) => {
    const ev = await ctx.db.query("events").withIndex("by_legistarId", (q) => q.eq("legistarId", eventId)).unique();
    if (!ev) return null;
    const districts = await councilDistricts(ctx);
    const members: Member[] = [];
    for (const m of await ctx.db.query("memberships").withIndex("by_body", (q) => q.eq("bodyId", ev.bodyId)).collect()) {
      const p = await ctx.db.query("persons").withIndex("by_legistarId", (q) => q.eq("legistarId", m.personId)).unique();
      if (!p) continue;
      const district = districts.get(m.personId);
      members.push({
        personId: m.personId,
        name: memberName(p.name),
        // On the Council itself the title is the district, shown as the district instead.
        ...(m.role && districtOf(m.role) === null && { role: m.role }),
        ...(district !== undefined && { district }),
      });
    }
    return { bodyName: ev.bodyName, members: sortMembers(members) };
  },
});

// Public, read-only: the alderperson whose Council seat is this district, or null.
export const alderFor = query({
  args: { district: v.number() },
  handler: async (ctx, { district }) => {
    for (const [personId, d] of await councilDistricts(ctx)) {
      if (d !== district) continue;
      const p = await ctx.db.query("persons").withIndex("by_legistarId", (q) => q.eq("legistarId", personId)).unique();
      return p ? { name: memberName(p.name), district } : null;
    }
    return null;
  },
});
