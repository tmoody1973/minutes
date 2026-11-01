import { v } from "convex/values";
import { query } from "./_generated/server";
import { NEAR_KINDS } from "./locations";
import { alertMessage } from "../lib/watcher/message";
import { label } from "../lib/timeline/build";
import { stepDate } from "../lib/ui/file";

const WEEK_MS = 7 * 86_400_000;
const MAX_CARDS = 5;
const ALSO_MAX = 6;

type Also = { href: string; title: string; meta: string };
const sentenceCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

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
    // Everything else on those agendas, for "Also at City Hall" (Tarik, 2026-11-01): zoning first, then the rest.
    const alsoUp: Also[] = [];
    for (const ev of upcoming) {
      for (const item of await ctx.db.query("eventItems").withIndex("by_event", (q) => q.eq("eventId", ev.legistarId)).collect()) {
        if (item.matterId === undefined || item.removedAt !== undefined || seen.has(item.matterId)) continue;
        const m = zoning.get(item.matterId);
        if (!m) {
          seen.add(item.matterId);
          if (item.fileNumber) alsoUp.push({ href: `/files/${item.fileNumber}`, title: item.title, meta: `${label(ev.bodyName)} · ${stepDate(ev.startsAt.slice(0, 10), ev.startsAt)}` });
          continue;
        }
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

    // Decided outside zoning: each file's latest decision in the last 7 days, read through the date index.
    const since = new Date(now - WEEK_MS).toISOString().slice(0, 19);
    const until = new Date(now).toISOString().slice(0, 19);
    const recent = await ctx.db.query("histories").withIndex("by_date", (q) => q.gt("date", since).lte("date", until)).collect();
    const latestByMatter = new Map<number, (typeof recent)[number]>();
    for (const h of recent.sort((a, b) => b.date.localeCompare(a.date))) {
      if (h.passed !== undefined && !zoning.has(h.matterId) && !latestByMatter.has(h.matterId)) latestByMatter.set(h.matterId, h);
    }
    const alsoDecided: Also[] = [];
    for (const h of [...latestByMatter.values()].slice(0, ALSO_MAX)) {
      const m = await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", h.matterId)).unique();
      if (m) alsoDecided.push({ href: `/files/${m.fileNumber}`, title: m.title, meta: `${label(h.bodyName)} · ${sentenceCase(h.actionName.trim())} · ${stepDate(h.date.slice(0, 10))}` });
    }

    return {
      comingUp: comingUp.slice(0, MAX_CARDS),
      decided: decided.slice(0, MAX_CARDS),
      also: { comingUp: alsoUp.slice(0, ALSO_MAX), comingUpCount: alsoUp.length, decided: alsoDecided, decidedCount: latestByMatter.size },
    };
  },
});
