import { internalQuery } from "./_generated/server";
import { label } from "../lib/timeline/build";

const PATH = new Set(["City Plan Commission", "Zoning, Neighborhoods & Development", "Common Council"]);

// Counts for the README (brief §10). Meeting-level numbers come from meetingView in scripts/metrics.ts.
export const counts = internalQuery({
  args: {},
  handler: async (ctx) => {
    // A file is "linked across bodies" when its history has steps at two or more of CPC, ZND and Council.
    const bodies = new Map<number, Set<string>>();
    for (const h of await ctx.db.query("histories").collect()) {
      const b = label(h.bodyName);
      if (PATH.has(b)) bodies.set(h.matterId, (bodies.get(h.matterId) ?? new Set()).add(b));
    }
    // Only each card's latest check: earlier runs (prompt changes, the "improvement" false alarms fixed on Nov 1)
    // stay in the log as history but no longer describe what is on the site.
    const cards = await ctx.db.query("cards").collect();
    const log = [];
    for (const c of cards) {
      const rows = await ctx.db.query("editorLog").withIndex("by_card", (q) => q.eq("cardKind", c.kind).eq("cardKey", c.key)).collect();
      log.push(...rows.filter((l) => l.at === c.writtenAt));
    }
    const reasons: Record<string, number> = {};
    for (const l of log) if (!l.ok) reasons[l.reason ?? "unknown"] = (reasons[l.reason ?? "unknown"] ?? 0) + 1;
    // Prefer a model rejection as the example: it shows the check doing more than a word list.
    const rejected = log.filter((l) => !l.ok);
    const example = rejected.find((l) => l.reason === "unsupported") ?? rejected[0] ?? null;
    return {
      filesTracked: (await ctx.db.query("matters").collect()).length,
      filesLinkedAcrossBodies: [...bodies.values()].filter((s) => s.size >= 2).length,
      editor: { checked: log.length, rejected: rejected.length, reasons, example: example && { text: example.text, reason: example.reason, detail: example.detail ?? null } },
      cards: { written: cards.length, shown: cards.filter((c) => c.sentences.length).length },
    };
  },
});
