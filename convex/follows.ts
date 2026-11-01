import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

const kindV = v.union(v.literal("file"), v.literal("address"), v.literal("alder"), v.literal("topic"));
type Kind = "file" | "address" | "alder" | "topic";
const MAX_FOLLOWS = 50;

// Validates and normalizes what is stored. An address keeps only coordinates rounded to 3 decimals (~100 m):
// enough for the half-mile match, never the typed address.
export function normalizeFollow(kind: Kind, raw: string): string {
  const value = raw.trim();
  switch (kind) {
    case "file":
      if (!/^\d{5,7}$/.test(value)) throw new Error("A file number is 5 to 7 digits.");
      return value;
    case "address": {
      const parts = value.split(",");
      const [lat, lng] = parts.map((p) => (p.trim() ? Number(p) : NaN));
      if (parts.length !== 2 || !(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw new Error("An address follow needs a latitude,longitude pair.");
      return `${lat.toFixed(3)},${lng.toFixed(3)}`;
    }
    case "alder": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 15) throw new Error("Milwaukee has aldermanic districts 1 to 15.");
      return String(n);
    }
    case "topic":
      if (value.length < 2 || value.length > 60) throw new Error("A topic is 2 to 60 characters.");
      return value.toLowerCase();
  }
}

async function signedIn(ctx: QueryCtx | MutationCtx) {
  return ctx.auth.getUserIdentity();
}

export async function requireUser(ctx: MutationCtx) {
  const id = await signedIn(ctx);
  if (!id) throw new Error("Sign in to follow files, addresses, alderpersons or topics.");
  const user = await ctx.db.query("users").withIndex("by_userId", (q) => q.eq("userId", id.tokenIdentifier)).unique();
  if (!user) {
    // Random token for the unsubscribe link in alert emails.
    const unsubscribeToken = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    await ctx.db.insert("users", { userId: id.tokenIdentifier, unsubscribeToken, ...(id.email && { email: id.email }) });
  } else if (id.email && id.email !== user.email) {
    await ctx.db.patch(user._id, { email: id.email });
  }
  return id.tokenIdentifier;
}

const findFollow = (ctx: QueryCtx, userId: string, kind: Kind, value: string) =>
  ctx.db.query("follows").withIndex("by_user_kind_value", (q) => q.eq("userId", userId).eq("kind", kind).eq("value", value)).unique();

export const follow = mutation({
  args: { kind: kindV, value: v.string(), label: v.string() },
  handler: async (ctx, { kind, value, label }) => {
    const userId = await requireUser(ctx);
    const normalized = normalizeFollow(kind, value);
    if (await findFollow(ctx, userId, kind, normalized)) return;
    const count = (await ctx.db.query("follows").withIndex("by_userId", (q) => q.eq("userId", userId)).collect()).length;
    if (count >= MAX_FOLLOWS) throw new Error(`You can follow up to ${MAX_FOLLOWS} things.`);
    // An area's label is built here from the rounded point, never taken from the client: it would carry the typed street.
    const name = kind === "address" ? `Area within half a mile of ${normalized.replace(",", ", ")}` : label.trim().slice(0, 120) || normalized;
    const now = Date.now();
    await ctx.db.insert("follows", { userId, kind, value: normalized, label: name, createdAt: now });
    await ctx.db.insert("activityLog", { userId, at: now, text: `Started following ${name}` });
  },
});

export const unfollow = mutation({
  args: { kind: kindV, value: v.string() },
  handler: async (ctx, { kind, value }) => {
    const userId = await requireUser(ctx);
    const row = await findFollow(ctx, userId, kind, normalizeFollow(kind, value));
    if (!row) return;
    await ctx.db.delete(row._id);
    await ctx.db.insert("activityLog", { userId, at: Date.now(), text: `Stopped following ${row.label}` });
  },
});

// null when signed out (the page shows a sign-in prompt instead).
export const myFollows = query({
  args: {},
  handler: async (ctx) => {
    const id = await signedIn(ctx);
    if (!id) return null;
    const rows = await ctx.db.query("follows").withIndex("by_userId", (q) => q.eq("userId", id.tokenIdentifier)).collect();
    return rows.sort((a, b) => a.createdAt - b.createdAt).map((f) => ({ kind: f.kind, value: f.value, label: f.label, createdAt: f.createdAt }));
  },
});

export const isFollowing = query({
  args: { kind: kindV, value: v.string() },
  handler: async (ctx, { kind, value }) => {
    const id = await signedIn(ctx);
    if (!id) return null;
    let normalized: string;
    try {
      normalized = normalizeFollow(kind, value);
    } catch {
      return false;
    }
    return !!(await findFollow(ctx, id.tokenIdentifier, kind, normalized));
  },
});
