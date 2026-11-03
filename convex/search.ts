import { v } from "convex/values";
import { query } from "./_generated/server";
import { expandAddress, snippet } from "../lib/search/query";
import { label } from "../lib/timeline/build";
import { stepDate } from "../lib/ui/file";
import { clock } from "../lib/ui/meeting";
import { placeHeading } from "../lib/ui/near";

const MAX = 10;

// Public search box: files by number, address or subject (title index), and words said in meetings (transcript
// index). Reads only the top matches; never parcels' owners (titles and file fields only).
export const search = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const text = q.trim().slice(0, 100);
    if (text.length < 2) return { files: [], quotes: [] };

    const exact = /^\d{5,7}$/.test(text)
      ? await ctx.db.query("matters").withIndex("by_fileNumber", (x) => x.eq("fileNumber", text)).first()
      : null;
    const titled = await ctx.db.query("matters").withSearchIndex("search_title", (x) => x.search("title", expandAddress(text))).take(MAX);
    const matters = [...(exact ? [exact] : []), ...titled.filter((m) => m._id !== exact?._id)].slice(0, MAX);
    const files = matters.map((m) => ({
      href: `/files/${m.fileNumber}`,
      heading: placeHeading(m.title, m.fileNumber),
      fileNumber: m.fileNumber,
      title: m.title,
      status: m.statusName,
    }));

    // The index favors short turns ("okay that's traffic"); skip fragments under 8 words so results are quotable.
    const turns = (await ctx.db.query("turns").withSearchIndex("search_text", (x) => x.search("text", text)).take(MAX * 3))
      .filter((t) => t.text.split(/\s+/).length >= 8)
      .slice(0, MAX);
    const chaptersOf = new Map<number, { eventItemId: number; startMs?: number; endMs?: number }[]>();
    const quotes = [];
    for (const t of turns) {
      const ev = await ctx.db.query("events").withIndex("by_legistarId", (x) => x.eq("legistarId", t.eventId)).unique();
      if (!ev) continue;
      if (!chaptersOf.has(t.eventId)) chaptersOf.set(t.eventId, await ctx.db.query("chapters").withIndex("by_event", (x) => x.eq("eventId", t.eventId)).collect());
      const ch = chaptersOf.get(t.eventId)!.find((c) => c.startMs !== undefined && c.endMs !== undefined && c.startMs <= t.startMs && t.startMs < c.endMs);
      quotes.push({
        href: `/meetings/${t.eventId}${ch ? `?item=${ch.eventItemId}` : ""}`,
        text: snippet(t.text, text),
        meeting: `${label(ev.bodyName)}, ${stepDate(ev.startsAt.slice(0, 10))}`,
        at: clock(t.startMs),
        captions: t.source === "captions",
      });
    }
    return { files, quotes };
  },
});
