import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, query, type QueryCtx } from "./_generated/server";
import { label } from "../lib/timeline/build";
import { actionText, stepDate } from "../lib/ui/file";
import { PART_LABELS } from "../lib/ui/meeting";
import { parseZoningChange } from "../lib/zoning/change";
import { evaluativeWord } from "../lib/editor/rules";

const kindV = v.union(v.literal("file"), v.literal("chapter"));
type Source = { label: string; text: string };

const tallyText = (t: NonNullable<Doc<"eventItems">["tally"]>) =>
  `${t.aye} aye, ${t.no} no, ${t.excused} excused${t.other ? `, ${t.other} other` : ""}`;
const outcome = (passed?: boolean) => (passed === true ? " (passed)" : passed === false ? " (failed)" : "");
const day = (iso: string) => stepDate(iso.slice(0, 10));
// The app's short label drops "committee", which a sentence needs ("the ZND committee recommended").
const bodyName = (name: string) => (label(name) === "Zoning, Neighborhoods & Development" ? "Zoning, Neighborhoods & Development committee" : label(name));

// The records a file card may cite, keyed like the rest of the app (history:<id> matches the Watcher's change keys).
// Never the owner: parcels are read for address, zoning, lot size and district only.
export async function fileSources(ctx: QueryCtx, fileNumber: string): Promise<Record<string, Source> | null> {
  const m = await ctx.db.query("matters").withIndex("by_fileNumber", (q) => q.eq("fileNumber", fileNumber)).first();
  if (!m) return null;
  const out: Record<string, Source> = {
    [`matter:${m.legistarId}`]: { label: `File ${m.fileNumber}`, text: `File ${m.fileNumber} (${m.typeName}): ${m.title} Status: ${m.statusName}.` },
  };
  const z = parseZoningChange(m.title);
  if (z.from && z.to) out[`zoning:${m.legistarId}`] = { label: "Zoning change", text: `Zoning change requested from ${z.from} to ${z.to}.` };
  for (const p of m.parcels ?? []) {
    const area = p.lotAreaSqFt === null ? "" : `, lot area ${p.lotAreaSqFt.toLocaleString("en-US")} sq ft`;
    const district = p.alder === null ? "" : `, aldermanic district ${p.alder}`;
    out[`parcel:${p.taxkey}`] = { label: p.address, text: `Lot at ${p.address}: zoned ${p.zoning ?? "unknown"}${area}${district}.` };
  }
  const items = await ctx.db.query("eventItems").withIndex("by_matter", (q) => q.eq("matterId", m.legistarId)).collect();
  const histories = await ctx.db.query("histories").withIndex("by_matter", (q) => q.eq("matterId", m.legistarId)).collect();
  for (const h of histories.sort((a, b) => a.date.localeCompare(b.date))) {
    // The agenda item's tally is its final vote: attach it to the matching step only, not to every amendment that day.
    const tally = items.find((i) => i.eventId === h.eventId && i.tally && i.actionName && actionText([i.actionName]) === actionText([h.actionName]))?.tally;
    out[`history:${h.legistarId}`] = {
      label: `${label(h.bodyName)}, ${day(h.date)}`,
      text: `${day(h.date)}: ${bodyName(h.bodyName)}: ${actionText([h.actionName])}${outcome(h.passed)}.${tally ? ` Vote: ${tallyText(tally)}.` : ""}`,
    };
  }
  // Hearings on an agenda with no action recorded yet.
  const acted = new Set(histories.map((h) => h.eventId));
  for (const i of items) {
    if (acted.has(i.eventId) || i.removedAt !== undefined) continue;
    const ev = await ctx.db.query("events").withIndex("by_legistarId", (q) => q.eq("legistarId", i.eventId)).unique();
    if (!ev || Date.parse(ev.startsAt) < Date.now()) continue;
    const when = stepDate(ev.startsAt.slice(0, 10), ev.startsAt);
    out[`item:${i.legistarId}`] = { label: `${label(ev.bodyName)}, ${when}`, text: `On the agenda of ${bodyName(ev.bodyName)} for ${when}.` };
  }
  return out;
}

async function chapterSources(ctx: QueryCtx, key: string): Promise<Record<string, Source> | null> {
  const [eventId, eventItemId] = key.split(":").map(Number);
  const item = await ctx.db.query("eventItems").withIndex("by_legistarId", (q) => q.eq("legistarId", eventItemId)).unique();
  const ev = await ctx.db.query("events").withIndex("by_legistarId", (q) => q.eq("legistarId", eventId)).unique();
  if (!item || !ev || item.eventId !== eventId) return null;
  const body = bodyName(ev.bodyName);
  const date = day(ev.startsAt);
  const action = item.actionName ? ` Action: ${item.actionName}${outcome(item.passed)}.` : "";
  const out: Record<string, Source> = {
    [`item:${item.legistarId}`]: {
      label: `${body} agenda, ${date}`,
      text: `${body} meeting, ${date}. Agenda item${item.fileNumber ? ` (file ${item.fileNumber})` : ""}: ${item.title}${action}${item.tally ? ` Vote: ${tallyText(item.tally)}.` : ""}`,
    },
  };
  if (item.matterId !== undefined) {
    const m = await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", item.matterId!)).unique();
    if (m) out[`matter:${m.legistarId}`] = { label: `File ${m.fileNumber}`, text: `File ${m.fileNumber} (${m.typeName}): ${m.title}` };
  }
  const ch = (await ctx.db.query("chapters").withIndex("by_event", (q) => q.eq("eventId", eventId)).collect()).find((c) => c.eventItemId === eventItemId);
  if (ch?.parts.length) {
    // Total minutes per part, in order of first appearance (testimony and discussion often alternate).
    const totals = new Map<string, number>();
    for (const p of ch.parts) totals.set(p.kind, (totals.get(p.kind) ?? 0) + (p.endMs - p.startMs));
    const parts = [...totals].map(([kind, ms]) => `${PART_LABELS[kind] ?? kind} ${Math.max(1, Math.round(ms / 60_000))} min`);
    out[`parts:${eventItemId}`] = { label: "Meeting recording", text: `In the meeting recording, this item has: ${parts.join(", ")}.` };
  }
  return out;
}

// What the writer script covers: files on the map (with lots) and meeting chapters about a file.
export const cardTargets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const files = (await ctx.db.query("matters").collect()).filter((m) => m.parcels?.length).map((m) => m.fileNumber);
    const chapters: string[] = [];
    for (const c of await ctx.db.query("chapters").collect()) {
      const item = await ctx.db.query("eventItems").withIndex("by_legistarId", (q) => q.eq("legistarId", c.eventItemId)).unique();
      if (item?.matterId !== undefined) chapters.push(`${c.eventId}:${c.eventItemId}`);
    }
    return { files, chapters };
  },
});

export const cardSources = internalQuery({
  args: { kind: kindV, key: v.string() },
  handler: async (ctx, { kind, key }) => {
    const sources = kind === "file" ? await fileSources(ctx, key) : await chapterSources(ctx, key);
    const stored = await ctx.db.query("cards").withIndex("by_kind_key", (q) => q.eq("kind", kind).eq("key", key)).unique();
    // A list, not an object: Convex returns object keys sorted, and the writer should read title, zoning, lots, then history.
    return { sources: sources && Object.entries(sources).map(([key, src]) => ({ key, ...src })), storedHash: stored?.sourcesHash ?? null };
  },
});

const verdictV = v.object({ ok: v.boolean(), reason: v.optional(v.string()), detail: v.optional(v.string()) });

// Stores only sentences the Editor passed; logs every verdict. Replaces the card's previous sentences.
export const saveCard = internalMutation({
  args: {
    kind: kindV,
    key: v.string(),
    sourcesHash: v.string(),
    sourceLabels: v.record(v.string(), v.string()),
    sentences: v.array(v.object({ text: v.string(), sourceKeys: v.array(v.string()), verdict: verdictV })),
  },
  handler: async (ctx, { kind, key, sourcesHash, sourceLabels, sentences }) => {
    const now = Date.now();
    for (const s of sentences) {
      await ctx.db.insert("editorLog", { cardKind: kind, cardKey: key, text: s.text, sourceKeys: s.sourceKeys, at: now, ...s.verdict });
    }
    // Defense in depth: the script's verdict is trusted only for sentences that also pass the cheap checks here.
    const kept = sentences
      .filter((s) => s.verdict.ok && s.sourceKeys.length > 0 && s.sourceKeys.every((k) => k in sourceLabels) && !evaluativeWord(s.text))
      .map(({ text, sourceKeys }) => ({ text, sourceKeys }));
    const used = new Set(kept.flatMap((s) => s.sourceKeys));
    const labels = Object.fromEntries(Object.entries(sourceLabels).filter(([k]) => used.has(k)));
    const row = { kind, key, sourcesHash, sentences: kept, sourceLabels: labels, writtenAt: now };
    const old = await ctx.db.query("cards").withIndex("by_kind_key", (q) => q.eq("kind", kind).eq("key", key)).unique();
    if (old) await ctx.db.replace(old._id, row);
    else await ctx.db.insert("cards", row);
    return kept.length;
  },
});

// Public: the approved sentences with the records each one cites. null when no card was written.
export const card = query({
  args: { kind: kindV, key: v.string() },
  handler: async (ctx, { kind, key }) => {
    if (!/^\d{5,7}$|^\d+:\d+$/.test(key)) return null;
    const c = await ctx.db.query("cards").withIndex("by_kind_key", (q) => q.eq("kind", kind).eq("key", key)).unique();
    if (!c?.sentences.length) return null;
    return { writtenAt: c.writtenAt, sentences: c.sentences.map((s) => ({ text: s.text, sources: s.sourceKeys.map((k) => c.sourceLabels[k] ?? k) })) };
  },
});
