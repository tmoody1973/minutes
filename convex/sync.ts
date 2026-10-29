import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import { legistarGet } from "../lib/legistar/client";
import { parseEvent, parseEventItem, parseHistory, parseMatter, parseVote } from "../lib/legistar/parse";
import { computeTally } from "../lib/legistar/tally";
import { eventsFilter, hasVotes, isMatterFresh, matterIdsOf, memberFilter } from "../lib/legistar/plan";

type Raw = Record<string, unknown>;

// Council 1, Zoning/Neighborhoods/Development 11, City Plan Commission 272.
const BODY_IDS = [1, 11, 272];
// Fan-out spacing: scheduled jobs start this far apart so Legistar (a public city API) sees a trickle.
const STAGGER_MS = 1000;

type Scope = "top" | "child";

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

// Collects per-record failures so one bad record never aborts the rest of a job.
function collector() {
  const errors: string[] = [];
  return {
    errors,
    async attempt(id: string, fn: () => Promise<void>) {
      try {
        await fn();
      } catch (err) {
        errors.push(`${id}: ${errText(err)}`);
      }
    },
  };
}

// Top-scope runs (only jobs that actually fetch from Legistar) write a row either way. Child jobs write ONE row,
// and only when something failed, listing every collected error. Data is never deleted.
async function recorded(ctx: ActionCtx, scope: Scope, label: string, work: (errors: ReturnType<typeof collector>) => Promise<void>) {
  const startedAt = Date.now();
  const c = collector();
  try {
    await work(c);
  } catch (err) {
    c.errors.push(errText(err));
  }
  const error = c.errors.length ? `${label}: ${c.errors.join("; ")}` : undefined;
  if (error) console.error(error);
  if (scope === "top" || error) {
    await ctx.runMutation(internal.legistar.recordSyncRun, { startedAt, finishedAt: Date.now(), ok: !error, error, scope });
  }
}

// Lists events in the window, upserts them, and fans out one syncEvent per event.
export const syncEvents = internalAction({
  args: { since: v.string(), until: v.optional(v.string()), bodyIds: v.array(v.number()) },
  handler: async (ctx, { since, until, bodyIds }) => {
    await recorded(ctx, "top", "syncEvents", async (c) => {
      const end = until ?? new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
      const raw = await legistarGet<Raw[]>("events", { $filter: eventsFilter(since, end, bodyIds) });
      for (const [i, r] of raw.entries()) {
        await c.attempt(`event ${String(r.EventId)}`, async () => {
          const event = parseEvent(r);
          await ctx.runMutation(internal.legistar.upsertEvent, event);
          await ctx.scheduler.runAfter(i * STAGGER_MS, internal.sync.syncEvent, { eventId: event.legistarId });
        });
      }
    });
  },
});

// One event: its items, their votes and tallies, and a syncMatter per linked matter.
// The event row must already exist (upsertEventItem's hearing_scheduled check reads it).
export const syncEvent = internalAction({
  args: { eventId: v.number() },
  handler: async (ctx, { eventId }) => {
    await recorded(ctx, "child", `syncEvent ${eventId}`, async (c) => {
      const items = (await legistarGet<Raw[]>(`events/${eventId}/eventitems`, { MinutesNote: "1" })).map(parseEventItem);
      for (const item of items) {
        await c.attempt(`item ${item.legistarId}`, async () => {
          await ctx.runMutation(internal.legistar.upsertEventItem, item);
          if (!hasVotes(item)) return;
          const votes = (await legistarGet<Raw[]>(`eventitems/${item.legistarId}/votes`)).map((r) => parseVote(r, item.legistarId));
          if (!votes.length) return;
          for (const vote of votes) await ctx.runMutation(internal.legistar.upsertPerson, { legistarId: vote.personId, name: vote.personName });
          await ctx.runMutation(internal.legistar.replaceVotes, { eventItemId: item.legistarId, votes });
          await ctx.runMutation(internal.legistar.setEventItemTally, { eventItemLegistarId: item.legistarId, tally: computeTally(votes) });
        });
      }
      await ctx.runMutation(internal.legistar.markEventItemsRemoved, {
        eventId,
        presentIds: items.map((i) => i.legistarId),
        at: Date.now(),
      });
      // Scheduled regardless of per-item failures above.
      for (const [i, matterId] of matterIdsOf(items).entries()) {
        await ctx.scheduler.runAfter(i * STAGGER_MS, internal.sync.syncMatter, { matterId });
      }
    });
  },
});

// One matter: record, history steps, and attachment list (name + link). Skipped if synced recently.
export const syncMatter = internalAction({
  args: { matterId: v.number() },
  handler: async (ctx, { matterId }) => {
    if (isMatterFresh(await ctx.runQuery(internal.legistar.matterSyncedAt, { matterId }), Date.now())) return;
    await recorded(ctx, "child", `syncMatter ${matterId}`, async (c) => {
      const matter = parseMatter(await legistarGet<Raw>(`matters/${matterId}`));
      const attachments = (await legistarGet<Raw[]>(`matters/${matterId}/attachments`)).flatMap((a) =>
        typeof a.MatterAttachmentHyperlink === "string" && a.MatterAttachmentHyperlink
          ? [{ name: String(a.MatterAttachmentName ?? ""), hyperlink: a.MatterAttachmentHyperlink }]
          : [],
      );
      await ctx.runMutation(internal.legistar.upsertMatter, { ...matter, attachments });
      for (const h of await legistarGet<Raw[]>(`matters/${matterId}/histories`)) {
        // Some rows carry no body (e.g. matter 74892 id 496081); a step with no body can't be shown, so skip it.
        if (typeof h.MatterHistoryActionBodyName !== "string") continue;
        await c.attempt(`history ${String(h.MatterHistoryId)}`, async () => {
          await ctx.runMutation(internal.legistar.upsertHistory, parseHistory(h, matterId));
        });
      }
      // Only a fully clean pass counts as fresh; a partial one is retried next run.
      if (!c.errors.length) await ctx.runMutation(internal.legistar.markMatterSynced, { matterId, at: Date.now() });
    });
  },
});

// Current members of the three bodies (office record not yet ended); title becomes the role.
// A person on several bodies gets one membership row per body.
export const syncPersons = internalAction({
  args: {},
  handler: async (ctx) => {
    await recorded(ctx, "child", "syncPersons", async (c) => {
      const today = new Date().toISOString().slice(0, 10);
      for (const bodyId of BODY_IDS) {
        const rows = await legistarGet<Raw[]>("officerecords", { $filter: memberFilter(bodyId, today) });
        for (const r of rows) {
          await c.attempt(`officerecord ${String(r.OfficeRecordId)}`, async () => {
            const legistarId = r.OfficeRecordPersonId as number;
            await ctx.runMutation(internal.legistar.upsertPerson, { legistarId, name: r.OfficeRecordFullName as string });
            const role = typeof r.OfficeRecordTitle === "string" && r.OfficeRecordTitle ? r.OfficeRecordTitle : undefined;
            await ctx.runMutation(internal.legistar.upsertMembership, { personId: legistarId, bodyId, role });
          });
        }
      }
    });
  },
});

// Nightly full walk: persons, then events (which fan out to items and matters) since Jan 1.
export const syncAll = internalAction({
  args: { since: v.optional(v.string()) },
  handler: async (ctx, { since }) => {
    // "child": it never reaches Legistar, so it must not advance lastSuccessfulSync; syncEvents does.
    await recorded(ctx, "child", "syncAll", async () => {
      await ctx.scheduler.runAfter(0, internal.sync.syncPersons, {});
      await ctx.scheduler.runAfter(0, internal.sync.syncEvents, {
        since: since ?? "2026-01-01",
        until: "2026-12-31",
        bodyIds: BODY_IDS,
      });
    });
  },
});

// Frequent refresh: 14 days back to 60 ahead.
export const syncRecent = internalAction({
  args: {},
  handler: async (ctx) => {
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    await ctx.runAction(internal.sync.syncEvents, { since: day(-14), until: day(60), bodyIds: BODY_IDS });
  },
});
