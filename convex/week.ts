import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import { NEAR_KINDS } from "./locations";
import { alertMessage } from "../lib/watcher/message";
import { label } from "../lib/timeline/build";
import { topicOfBody, topicOfFile, type Topic } from "../lib/topics";
import { stepDate } from "../lib/ui/file";

const WEEK_MS = 7 * 86_400_000;
const MAX_ITEMS = 200;

export type WeekItem = { href: string; title: string; meta?: string; topic: Topic; at: string };
const sentenceCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

// Public, read-only: "This week at City Hall" across every synced body (decision 008). Each file appears once per
// group, sorted into a topic by the committee rule (lib/topics). Zoning files keep the Watcher's address-led wording;
// the rest show their record title. `now` is passed in (rounded by the page) so the result is cacheable and testable.
export const weekAtCityHall = query({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const zoning = new Map<number, { fileNumber: string; title: string }>();
    for (const kind of NEAR_KINDS) {
      for (const m of await ctx.db.query("matterLocations").withIndex("by_kind", (q) => q.eq("kind", kind)).collect()) {
        zoning.set(m.matterId, { fileNumber: m.fileNumber, title: m.title });
      }
    }
    // Zoning files are Development; otherwise the body acting now, else the file's first committee.
    const topicOf = async (matterId: number, bodyName: string): Promise<Topic> =>
      zoning.has(matterId) ? "development" : (topicOfBody(bodyName) ?? topicOfFile(await historyBodies(ctx, matterId)));

    // Coming up: files on an agenda in the next 7 days, soonest first, one card per file.
    // ponytail: scans the events table (a few hundred rows per year); add a startsAt index if it grows.
    const upcoming = (await ctx.db.query("events").collect())
      .filter((e) => {
        const at = Date.parse(e.startsAt);
        return at > now && at <= now + WEEK_MS;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const comingUp: WeekItem[] = [];
    const seen = new Set<number>();
    for (const ev of upcoming) {
      for (const item of await ctx.db.query("eventItems").withIndex("by_event", (q) => q.eq("eventId", ev.legistarId)).collect()) {
        if (item.matterId === undefined || item.removedAt !== undefined || seen.has(item.matterId)) continue;
        const z = zoning.get(item.matterId);
        if (!z && !item.fileNumber) continue;
        seen.add(item.matterId);
        const topic = await topicOf(item.matterId, ev.bodyName);
        if (z) {
          const { href, message } = alertMessage({ kind: "hearing_scheduled", ...z, bodyName: ev.bodyName, startsAt: ev.startsAt });
          comingUp.push({ href, title: message, topic, at: ev.startsAt });
        } else {
          comingUp.push({ href: `/files/${item.fileNumber}`, title: item.title, meta: `On the ${label(ev.bodyName)} agenda, ${stepDate(ev.startsAt.slice(0, 10), ev.startsAt)}`, topic, at: ev.startsAt });
        }
      }
    }

    // Decided: each file's latest recorded decision in the last 7 days, newest first, read through the date index.
    const since = new Date(now - WEEK_MS).toISOString().slice(0, 19);
    const until = new Date(now).toISOString().slice(0, 19);
    const recent = await ctx.db.query("histories").withIndex("by_date", (q) => q.gt("date", since).lte("date", until)).collect();
    const latest = new Map<number, (typeof recent)[number]>();
    for (const h of recent.sort((a, b) => b.date.localeCompare(a.date))) {
      if (h.passed !== undefined && !latest.has(h.matterId)) latest.set(h.matterId, h);
    }
    const decided: WeekItem[] = [];
    for (const h of [...latest.values()].slice(0, MAX_ITEMS)) {
      const topic = await topicOf(h.matterId, h.bodyName);
      const z = zoning.get(h.matterId);
      if (z) {
        const { href, message } = alertMessage({ kind: "decision", ...z, date: h.date, bodyName: h.bodyName, actionName: h.actionName });
        decided.push({ href, title: message, topic, at: h.date });
        continue;
      }
      const m = await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", h.matterId)).unique();
      if (m)
        decided.push({ href: `/files/${m.fileNumber}`, title: m.title, meta: `${sentenceCase(h.actionName.replace(/\s+/g, " ").trim())} at ${label(h.bodyName)}, ${stepDate(h.date.slice(0, 10))}`, topic, at: h.date });
    }

    return { comingUp: comingUp.slice(0, MAX_ITEMS), decided };
  },
});

async function historyBodies(ctx: QueryCtx, matterId: number): Promise<string[]> {
  const rows = await ctx.db.query("histories").withIndex("by_matter", (q) => q.eq("matterId", matterId)).collect();
  return rows.sort((a, b) => a.date.localeCompare(b.date)).map((h) => h.bodyName);
}
