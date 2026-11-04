import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Written by scripts/ingest-docs.ts, which downloads each PDF and runs pdftotext on Tarik's machine.

// Which of these PDFs are already stored (with or without text).
export const storedHyperlinks = internalQuery({
  args: { hyperlinks: v.array(v.string()) },
  handler: async (ctx, { hyperlinks }) => {
    const out: string[] = [];
    for (const h of hyperlinks) if (await ctx.db.query("documents").withIndex("by_hyperlink", (q) => q.eq("hyperlink", h)).first()) out.push(h);
    return out;
  },
});

// The PDFs of files that are active now: a step on or after `since`, or an agenda item still to come.
export const targets = internalQuery({
  args: { since: v.string(), now: v.string() },
  handler: async (ctx, { since, now }) => {
    const matterIds = new Set((await ctx.db.query("histories").withIndex("by_date", (q) => q.gte("date", since)).collect()).map((h) => h.matterId));
    for (const ev of await ctx.db.query("events").collect()) {
      if (ev.startsAt < now) continue;
      for (const i of await ctx.db.query("eventItems").withIndex("by_event", (q) => q.eq("eventId", ev.legistarId)).collect()) if (i.matterId !== undefined) matterIds.add(i.matterId);
    }
    const out: { hyperlink: string; name: string; matterId: number; fileNumber: string }[] = [];
    for (const matterId of matterIds) {
      const m = await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", matterId)).unique();
      for (const a of m?.attachments ?? []) if (/\.pdf$/i.test(a.hyperlink)) out.push({ hyperlink: a.hyperlink, name: a.name, matterId, fileNumber: m!.fileNumber });
    }
    return out;
  },
});

const docV = v.object({ hyperlink: v.string(), name: v.string(), matterId: v.number(), fileNumber: v.string(), passages: v.array(v.string()) });

export const saveDocs = internalMutation({
  args: { docs: v.array(docV) },
  handler: async (ctx, { docs }) => {
    let saved = 0;
    for (const { passages, ...d } of docs) {
      if (await ctx.db.query("documents").withIndex("by_hyperlink", (q) => q.eq("hyperlink", d.hyperlink)).first()) continue;
      await ctx.db.insert("documents", { ...d, passages: passages.length, at: Date.now() });
      for (const [n, text] of passages.entries()) await ctx.db.insert("docPassages", { ...d, n, text });
      saved++;
    }
    return { saved };
  },
});
