"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { stepDate } from "../../../lib/ui/file";

const card = "rounded-[14px] border border-line bg-white p-4";
const KIND = { file: "File", address: "Area", alder: "Alderperson", topic: "Topic" } as const;
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function FollowingClient() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSignedIn } = useAuth();
  if (isLoading) return <p className="text-[15px] text-muted">Loading…</p>;
  // Signed in to Clerk but Convex refused the token: offering sign-in again would only error.
  if (!isAuthenticated && isSignedIn) {
    return <p role="alert" className="text-[15px] font-semibold text-amber-fg">You&rsquo;re signed in, but Minutes couldn&rsquo;t connect your account. Reload the page and try again.</p>;
  }
  if (!isAuthenticated) {
    return (
      <div className={`${card} flex max-w-xl flex-col gap-3`}>
        <p className="text-[15px]">Sign in to follow files, your area or your alderperson. Minutes tells you only when a hearing is scheduled or a decision is made.</p>
        <SignInButton mode="modal">
          <button type="button" className="min-h-12 self-start rounded-xl bg-link px-5 text-base font-bold text-white hover:bg-ink">
            Sign in
          </button>
        </SignInButton>
      </div>
    );
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <WatchList />
      <Inbox />
      <EmailSettings />
      <Activity />
    </div>
  );
}

function WatchList() {
  const follows = useQuery(api.follows.myFollows, {});
  const unfollow = useMutation(api.follows.unfollow);
  return (
    <section aria-labelledby="watch-heading" className={card}>
      <h2 id="watch-heading" className="mb-2 text-[17px] font-extrabold">
        What you follow
      </h2>
      {follows === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !follows?.length ? (
        <p className="text-sm text-muted">
          Nothing yet. <Link href="/ask">Ask about something</Link> and follow it, follow a file from its page, or your area from <Link href="/near">Near me</Link>.
        </p>
      ) : (
        <ul className="flex flex-col">
          {follows.map((f) => (
            <li key={`${f.kind}${f.value}`} className="flex min-h-11 items-center justify-between gap-3 border-b border-map last:border-b-0">
              <span className="text-[15px]">
                <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">{KIND[f.kind].toUpperCase()} · </span>
                {f.kind === "file" ? <Link href={`/files/${f.value}`}>{f.label}</Link> : f.label}
                {f.kind === "topic" && f.label !== f.value && <span className="block text-[13px] text-muted">Watching for: {f.value}</span>}
              </span>
              <button type="button" onClick={() => unfollow({ kind: f.kind, value: f.value })} className="min-h-11 text-sm font-semibold text-link underline underline-offset-[0.18em] hover:text-ink">
                Stop following
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Inbox() {
  const alerts = useQuery(api.watcher.inbox, {});
  return (
    <section aria-labelledby="inbox-heading" className={card}>
      <h2 id="inbox-heading" className="mb-2 text-[17px] font-extrabold">
        Alerts
      </h2>
      {alerts === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !alerts?.length ? (
        <p className="text-sm text-muted">No alerts yet. You&apos;ll get one when something you follow is scheduled for a hearing or decided.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5">
              {a.replay && a.replayOf && <span className="text-[13px] font-bold text-amber-fg">Replay of a real alert from {stepDate(a.replayOf.slice(0, 10))}</span>}
              <Link href={a.href} className="text-[15px] font-semibold">
                {a.message}
              </Link>
              <span className="text-xs text-muted">
                {when(a.createdAt)}
                {a.emailed && " · emailed"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmailSettings() {
  const settings = useQuery(api.watcher.emailSettings, {});
  const set = useMutation(api.watcher.setEmailAlerts);
  if (!settings) return null;
  return (
    <section aria-labelledby="email-heading" className={card}>
      <h2 id="email-heading" className="mb-1 text-[17px] font-extrabold">
        Email
      </h2>
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" checked={settings.on} onChange={(e) => set({ on: e.target.checked })} className="size-5" />
        Email me each alert{settings.email ? ` at ${settings.email}` : ""}
      </label>
    </section>
  );
}

function Activity() {
  const rows = useQuery(api.watcher.activity, {});
  if (!rows?.length) return null;
  return (
    <section aria-labelledby="activity-heading" className={card}>
      <h2 id="activity-heading" className="mb-2 text-[17px] font-extrabold">
        Activity
      </h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {rows.map((r, i) => (
          <li key={i}>
            <span className="text-muted">{when(r.at)}</span> · {r.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
