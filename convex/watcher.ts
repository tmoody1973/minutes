import { v } from "convex/values";
import { DISCLOSURE } from "../lib/ui/shell";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction, internalMutation, internalQuery, mutation, type MutationCtx, query } from "./_generated/server";
import { stepDate } from "../lib/ui/file";
import { alertable, type MatterContext, matchesFollow } from "../lib/watcher/match";
import { alertMessage, type AlertFacts } from "../lib/watcher/message";
import { requireUser } from "./follows";

const BATCH = 500;
const MAX_ROUNDS = 20;
const FROM = "Minutes <onboarding@resend.dev>"; // Resend's test sender until a domain is verified (Tarik, 2026-10-30)

type Matter = MatterContext & { matterId: number };

async function matterContext(ctx: MutationCtx, matterId: number): Promise<Matter | null> {
  const m = await ctx.db.query("matters").withIndex("by_legistarId", (q) => q.eq("legistarId", matterId)).unique();
  if (!m) return null;
  const parcels = m.parcels ?? [];
  return {
    matterId,
    fileNumber: m.fileNumber,
    title: m.title,
    centroids: parcels.flatMap((p) => (p.centroid ? [p.centroid] : [])),
    alders: parcels.flatMap((p) => (p.alder === null ? [] : [p.alder])),
  };
}

// The record fields an alert is written from: the meeting for a scheduled hearing, the history row for a decision.
async function factsFor(ctx: MutationCtx, c: Doc<"changes">, m: Matter): Promise<AlertFacts> {
  if (c.kind === "hearing_scheduled") {
    const ev = c.eventId === undefined ? null : await ctx.db.query("events").withIndex("by_legistarId", (q) => q.eq("legistarId", c.eventId!)).unique();
    return { kind: "hearing_scheduled", fileNumber: m.fileNumber, title: m.title, ...(ev && { bodyName: ev.bodyName, startsAt: ev.startsAt }) };
  }
  const historyId = Number(c.sourceKey.replace(/^history:/, ""));
  const h = await ctx.db.query("histories").withIndex("by_legistarId", (q) => q.eq("legistarId", historyId)).unique();
  return { kind: c.kind === "introduced" ? "introduced" : "decision", fileNumber: m.fileNumber, title: m.title, date: c.at, ...(h && { bodyName: h.bodyName, actionName: h.actionName }) };
}

// At most one alert per (user, sourceKey). Returns the new alert's id, or null if it already existed.
async function createAlert(ctx: MutationCtx, userId: string, sourceKey: string, c: Doc<"changes">, m: Matter, replayOf?: string): Promise<Id<"alerts"> | null> {
  const dup = await ctx.db.query("alerts").withIndex("by_user_source", (q) => q.eq("userId", userId).eq("sourceKey", sourceKey)).first();
  if (dup) return null;
  const { message, href } = alertMessage(await factsFor(ctx, c, m));
  const now = Date.now();
  const id = await ctx.db.insert("alerts", {
    userId,
    sourceKey,
    matterId: m.matterId,
    changeKind: c.kind,
    message,
    href,
    createdAt: now,
    replay: replayOf !== undefined,
    ...(replayOf !== undefined && { replayOf }),
  });
  await ctx.db.insert("activityLog", { userId, at: now, text: `${replayOf !== undefined ? "Replay alert" : "Alert"}: ${message}` });
  return id;
}

// One pass over changes recorded since the cursor. A follow only hears about changes recorded after it was made,
// so following a file never replays its history (and the first run over the backfill alerts no one).
export const collectAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query("watcherState").withIndex("by_key", (q) => q.eq("key", "cursor")).unique();
    const changes = await ctx.db
      .query("changes")
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", state?.changesThrough ?? 0))
      .take(BATCH);
    // ponytail: every follow on every run; fine for hundreds of users, index by kind/value if it grows.
    const follows = await ctx.db.query("follows").collect();
    const alertIds: Id<"alerts">[] = [];
    for (const c of changes) {
      if (!alertable(c.kind) || !follows.length) continue;
      const m = await matterContext(ctx, c.matterId);
      if (!m) continue;
      for (const f of follows) {
        // Both _creationTime values come from Convex's ordered commit clock (sub-millisecond), unlike createdAt.
        if (f._creationTime > c._creationTime || !matchesFollow(c, f, m)) continue;
        const id = await createAlert(ctx, f.userId, c.sourceKey, c, m);
        if (id) alertIds.push(id);
      }
    }
    const last = changes.at(-1);
    if (last) {
      if (state) await ctx.db.patch(state._id, { changesThrough: last._creationTime });
      else await ctx.db.insert("watcherState", { key: "cursor", changesThrough: last._creationTime });
    }
    return { alertIds, more: changes.length === BATCH };
  },
});

// Who to email for one alert, or null (no address on file, or emails turned off).
export const emailTarget = internalQuery({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, { alertId }) => {
    const a = await ctx.db.get(alertId);
    if (!a) return null;
    const u = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", a.userId)).unique();
    if (!u?.email || u.emailOff) return null;
    return { to: u.email, token: u.unsubscribeToken, message: a.message, href: a.href, replayOf: a.replayOf ?? null };
  },
});

export const markEmailed = internalMutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, { alertId }) => {
    const a = await ctx.db.get(alertId);
    if (!a) return;
    await ctx.db.patch(alertId, { emailedAt: Date.now() });
    await ctx.db.insert("activityLog", { userId: a.userId, at: Date.now(), text: "Emailed you an alert" });
  },
});

// Email goes out only when RESEND_API_KEY is set; otherwise alerts stay on the site (logged, never an error).
async function sendEmails(ctx: ActionCtx, alertIds: Id<"alerts">[]) {
  const key = process.env.RESEND_API_KEY;
  if (!alertIds.length) return;
  if (!key) {
    console.log(`Watcher: ${alertIds.length} alert(s) on the site only (RESEND_API_KEY not set)`);
    return;
  }
  const site = process.env.SITE_URL;
  if (!site) {
    // Without it every record and unsubscribe link would point nowhere; alerts stay on the site.
    console.error(`Watcher: SITE_URL not set; ${alertIds.length} alert email(s) not sent`);
    return;
  }
  for (const alertId of alertIds) {
    const t = await ctx.runQuery(internal.watcher.emailTarget, { alertId });
    if (!t) continue;
    const text = [
      ...(t.replayOf ? [`Replay of a real alert from ${stepDate(t.replayOf.slice(0, 10))}`, ""] : []),
      t.message,
      "",
      `Read the public record: ${site}${t.href}`,
      "",
      "You get this because you follow it on Minutes.",
      "",
      DISCLOSURE,
      "",
      `Stop these emails: ${site}/unsubscribe?token=${t.token}`,
    ].join("\n");
    // Mail apps truncate long subjects anyway; cut at a word so it never ends mid-word.
    const subject = t.message.length <= 90 ? t.message : `${t.message.slice(0, 90).replace(/\s+\S*$/, "").replace(/[\s,;:.]+$/, "")}…`;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: t.to, subject: `Minutes: ${subject}`, text }),
      });
      if (res.ok) await ctx.runMutation(internal.watcher.markEmailed, { alertId });
      // Logged without the address; the alert stays on the site either way.
      else console.error(`Watcher: Resend refused alert ${alertId}: ${res.status}`);
    } catch (err) {
      console.error(`Watcher: email for alert ${alertId} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ponytail: alerts are committed before their emails go out; a crash mid-send leaves those alerts on the site
// without an email (no retry). Add a sweep over alerts with no emailedAt if that ever matters.
export const runWatcher = internalAction({
  args: {},
  handler: async (ctx) => {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const { alertIds, more } = await ctx.runMutation(internal.watcher.collectAlerts, {});
      await sendEmails(ctx, alertIds);
      if (!more) return;
    }
  },
});

export const emailAlerts = internalAction({
  args: { alertIds: v.array(v.id("alerts")) },
  handler: async (ctx, { alertIds }) => sendEmails(ctx, alertIds),
});

// Admin only (ADMIN_USER_IDS = Clerk user ids, comma separated): re-sends a real past change to everyone following
// it now, labeled "Replay of a real alert from {date}" (spec: the demo fallback if no live change arrives).
const adminIds = () => (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
async function requireAdmin(ctx: MutationCtx) {
  const id = await ctx.auth.getUserIdentity();
  if (!id || !adminIds().includes(id.subject)) throw new Error("Only an admin can replay an alert.");
  return id;
}

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const id = await ctx.auth.getUserIdentity();
    return !!id && adminIds().includes(id.subject);
  },
});

export const replayChange = mutation({
  args: { sourceKey: v.string() },
  handler: async (ctx, { sourceKey }) => {
    await requireAdmin(ctx);
    const c = await ctx.db.query("changes").withIndex("by_sourceKey", (q) => q.eq("sourceKey", sourceKey)).unique();
    if (!c || !alertable(c.kind)) throw new Error(`No hearing or decision change with source key ${sourceKey}.`);
    const m = await matterContext(ctx, c.matterId);
    if (!m) throw new Error(`No file stored for matter ${c.matterId}.`);
    const alertIds: Id<"alerts">[] = [];
    for (const f of await ctx.db.query("follows").collect()) {
      if (!matchesFollow(c, f, m)) continue;
      const alertId = await createAlert(ctx, f.userId, `replay:${sourceKey}`, c, m, c.at);
      if (alertId) alertIds.push(alertId);
    }
    if (alertIds.length) await ctx.scheduler.runAfter(0, internal.watcher.emailAlerts, { alertIds });
    return alertIds.length;
  },
});

// ---- the signed-in user's own data (null when signed out) ----

const CANDIDATES_PER_WORD = 25;

// Admin only, for demos: replays the newest real hearing or decision matching one of the admin's own file or topic
// follows, to the admin alone (never to other followers). Each call goes one change further back, since a change
// already replayed to this admin is skipped.
export const replayLatest = mutation({
  args: { kind: v.union(v.literal("file"), v.literal("topic")), value: v.string() },
  handler: async (ctx, { kind, value }) => {
    const id = await requireAdmin(ctx);
    const f = await ctx.db.query("follows").withIndex("by_user_kind_value", (q) => q.eq("userId", id.tokenIdentifier).eq("kind", kind).eq("value", value)).unique();
    if (!f) throw new Error("Follow this first, then replay it.");
    const matters =
      kind === "file"
        ? await ctx.db.query("matters").withIndex("by_fileNumber", (q) => q.eq("fileNumber", value)).take(1)
        : (await Promise.all(value.split(",").map((w) => ctx.db.query("matters").withSearchIndex("search_title", (q) => q.search("title", w.trim())).take(CANDIDATES_PER_WORD)))).flat();
    const changes: { c: Doc<"changes">; m: Matter }[] = [];
    for (const matterId of new Set(matters.map((m) => m.legistarId))) {
      const m = await matterContext(ctx, matterId);
      if (!m) continue;
      const rows = await ctx.db.query("changes").withIndex("by_matter", (q) => q.eq("matterId", matterId)).collect();
      for (const c of rows) if (alertable(c.kind) && matchesFollow(c, f, m)) changes.push({ c, m });
    }
    for (const { c, m } of changes.sort((a, b) => b.c.at.localeCompare(a.c.at))) {
      const alertId = await createAlert(ctx, id.tokenIdentifier, `replay:${c.sourceKey}`, c, m, c.at);
      if (!alertId) continue;
      await ctx.scheduler.runAfter(0, internal.watcher.emailAlerts, { alertIds: [alertId] });
      return { replayOf: c.at, href: `/files/${m.fileNumber}` };
    }
    throw new Error("No earlier real hearing or decision to replay for this follow.");
  },
});

export const inbox = query({
  args: {},
  handler: async (ctx) => {
    const id = await ctx.auth.getUserIdentity();
    if (!id) return null;
    const rows = await ctx.db.query("alerts").withIndex("by_userId", (q) => q.eq("userId", id.tokenIdentifier)).order("desc").take(50);
    return rows.map((a) => ({
      id: a._id,
      message: a.message,
      href: a.href,
      createdAt: a.createdAt,
      replay: a.replay,
      replayOf: a.replayOf ?? null,
      emailed: a.emailedAt !== undefined,
    }));
  },
});

export const activity = query({
  args: {},
  handler: async (ctx) => {
    const id = await ctx.auth.getUserIdentity();
    if (!id) return null;
    const rows = await ctx.db.query("activityLog").withIndex("by_userId", (q) => q.eq("userId", id.tokenIdentifier)).order("desc").take(50);
    return rows.map((r) => ({ at: r.at, text: r.text }));
  },
});

export const emailSettings = query({
  args: {},
  handler: async (ctx) => {
    const id = await ctx.auth.getUserIdentity();
    if (!id) return null;
    const u = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", id.tokenIdentifier)).unique();
    return { email: u?.email ?? id.email ?? null, on: !u?.emailOff };
  },
});

export const setEmailAlerts = mutation({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("Sign in to change alert emails.");
    const userId = await requireUser(ctx); // creates the user row if this person has never followed anything
    const u = (await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", userId)).unique())!;
    await ctx.db.patch(u._id, { emailOff: !on });
    await ctx.db.insert("activityLog", { userId: u.userId, at: Date.now(), text: on ? "Turned on alert emails" : "Turned off alert emails" });
  },
});

// Public: the link in every email. The token is random and only turns email off; on-site alerts continue.
export const unsubscribe = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!/^[a-f0-9]{32}$/.test(token)) return { ok: false };
    const u = await ctx.db.query("users").withIndex("by_unsubscribeToken", (q) => q.eq("unsubscribeToken", token)).unique();
    if (!u) return { ok: false };
    if (!u.emailOff) {
      await ctx.db.patch(u._id, { emailOff: true });
      await ctx.db.insert("activityLog", { userId: u.userId, at: Date.now(), text: "Turned off alert emails (unsubscribe link)" });
    }
    return { ok: true };
  },
});
