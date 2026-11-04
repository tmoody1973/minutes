import { v } from "convex/values";
import { query } from "./_generated/server";
import { fileSources } from "./editor";
import { expandAddress, withWordForms } from "../lib/search/query";
import { label } from "../lib/timeline/build";
import { TOPICS, topicOfFile } from "../lib/topics";
import { actionText, stepDate, isFileNumber } from "../lib/ui/file";
import { clock } from "../lib/ui/meeting";

// Ask Minutes' lookups (decision 008). Each returns records keyed like the Editor's sources, so an answer sentence can
// cite exactly what the agent read. Public and read-only, like the rest of the site; never parcel owners.
type Rec = { key: string; label: string; text: string; href: string };
const MAX = 8;
const DAY_MS = 86_400_000;

export const findFiles = query({
  args: { q: v.string() },
  handler: async (ctx, { q }): Promise<Rec[]> => {
    const text = q.trim().slice(0, 100);
    if (text.length < 2) return [];
    const exact = isFileNumber(text)
      ? await ctx.db.query("matters").withIndex("by_fileNumber", (x) => x.eq("fileNumber", text.toUpperCase())).first()
      : null;
    const titled = await ctx.db.query("matters").withSearchIndex("search_title", (x) => x.search("title", withWordForms(expandAddress(text)))).take(MAX);
    const matters = [...(exact ? [exact] : []), ...titled.filter((m) => m._id !== exact?._id)].slice(0, MAX);
    const out: Rec[] = [];
    for (const m of matters) {
      const hist = (await ctx.db.query("histories").withIndex("by_matter", (x) => x.eq("matterId", m.legistarId)).collect()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const last = hist.at(-1);
      const lastText = last ? ` Latest step: ${stepDate(last.date.slice(0, 10))}, ${label(last.bodyName)}, ${actionText([last.actionName])}.` : "";
      out.push({
        key: `matter:${m.legistarId}`,
        label: `File ${m.fileNumber}`,
        text: `File ${m.fileNumber} (${m.typeName}, topic: ${TOPICS[topicOfFile(hist.map((h) => h.bodyName))]}): ${m.title} Status: ${m.statusName}.${lastText}`,
        href: `/files/${m.fileNumber}`,
      });
    }
    return out;
  },
});

// Every record behind one file: the same set its plain-language card may cite, except that identical steps (the
// budget has dozens of "Amended (failed)" on one day) collapse into the first one's record with a count.
export const fileRecords = query({
  args: { fileNumber: v.string() },
  handler: async (ctx, { fileNumber }): Promise<Rec[]> => {
    const sources = await fileSources(ctx, fileNumber.trim());
    if (!sources) return [];
    const n = fileNumber.trim();
    // Each step names its file, so a sentence citing only a step can still say which file it was.
    const groups = new Map<string, { key: string; label: string; n: number }>();
    for (const [key, s] of Object.entries(sources)) {
      const g = groups.get(s.text);
      groups.set(s.text, g ? { ...g, n: g.n + 1 } : { key, label: s.label, n: 1 });
    }
    return [...groups].map(([text, g]) => ({
      key: g.key,
      label: g.label,
      // "…: Amended (failed)." -> "…: Amended (failed), 3 times." (before any " Vote: …").
      text: g.key.startsWith("matter:") ? text : `File ${n}, ${g.n > 1 ? text.replace(/\.(?= Vote:|$)/, `, ${g.n} times.`) : text}`,
      href: `/files/${n}`,
    }));
  },
});

// Words said in meetings. Speakers stay unnamed here: only confirmed names appear on meeting pages.
export const findMoments = query({
  args: { q: v.string() },
  handler: async (ctx, { q }): Promise<Rec[]> => {
    const text = q.trim().slice(0, 100);
    if (text.length < 2) return [];
    const turns = (await ctx.db.query("turns").withSearchIndex("search_text", (x) => x.search("text", text)).take(MAX * 3))
      .filter((t) => t.text.split(/\s+/).length >= 8)
      .slice(0, MAX);
    const out: Rec[] = [];
    for (const t of turns) {
      const ev = await ctx.db.query("events").withIndex("by_legistarId", (x) => x.eq("legistarId", t.eventId)).unique();
      if (!ev) continue;
      // The meeting page opens a chapter (?item=), as the search box does; a quote outside every chapter opens the meeting.
      const ch = (await ctx.db.query("chapters").withIndex("by_event", (x) => x.eq("eventId", t.eventId)).collect()).find(
        (c) => c.startMs !== undefined && c.endMs !== undefined && c.startMs <= t.startMs && t.startMs < c.endMs,
      );
      const where = `${label(ev.bodyName)} meeting, ${stepDate(ev.startsAt.slice(0, 10))}, at ${clock(t.startMs)}`;
      out.push({
        key: `turn:${t.eventId}:${t.turnKey}`,
        label: where,
        text: `${where}${t.source === "captions" ? " (city captions)" : ""}, someone said: "${t.text}"`,
        href: `/meetings/${t.eventId}${ch ? `?item=${ch.eventItemId}` : ""}`,
      });
    }
    return out;
  },
});

// Words inside files' attached documents (staff reports, fiscal notes, contracts), as synced by scripts/ingest-docs.ts.
export const findInDocuments = query({
  args: { q: v.string() },
  handler: async (ctx, { q }): Promise<Rec[]> => {
    const text = q.trim().slice(0, 100);
    if (text.length < 2) return [];
    const hits = await ctx.db.query("docPassages").withSearchIndex("search_text", (x) => x.search("text", text)).take(MAX);
    return hits.map((p) => ({
      key: `doc:${p._id}`,
      label: `${p.name}, file ${p.fileNumber}`,
      text: `From "${p.name}", attached to file ${p.fileNumber}: ${p.text}`,
      href: `/files/${p.fileNumber}`,
    }));
  },
});

// Agenda items in the next `days` days (at most 14), soonest first. `now` comes from the caller, rounded, so it caches.
export const upcoming = query({
  args: { now: v.number(), days: v.number() },
  handler: async (ctx, { now, days }): Promise<Rec[]> => {
    const until = now + Math.min(Math.max(days, 1), 14) * DAY_MS;
    // ponytail: scans events (a few hundred a year), same as weekAtCityHall; add a startsAt index if it grows.
    const events = (await ctx.db.query("events").collect())
      .filter((e) => Date.parse(e.startsAt) > now && Date.parse(e.startsAt) <= until)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const out: Rec[] = [];
    for (const ev of events) {
      const when = stepDate(ev.startsAt.slice(0, 10), ev.startsAt);
      for (const i of await ctx.db.query("eventItems").withIndex("by_event", (x) => x.eq("eventId", ev.legistarId)).collect()) {
        if (!i.fileNumber || i.removedAt !== undefined) continue;
        out.push({
          key: `item:${i.legistarId}`,
          label: `${label(ev.bodyName)}, ${when}`,
          text: `On the agenda of ${label(ev.bodyName)} for ${when}: ${i.title} (file ${i.fileNumber}).`,
          href: `/files/${i.fileNumber}`,
        });
        if (out.length >= 60) return out;
      }
    }
    return out;
  },
});
