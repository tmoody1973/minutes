"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { bodyLabel } from "../../../lib/ui/near";

type Meeting = FunctionReturnType<typeof api.media.meetingList>[number];

const SOURCE = { transcript: "Transcript with speakers", captions: "City machine captions", none: "No transcript yet" } as const;
const PAST_SHOWN = 24;

// Every synced meeting: coming up first (soonest first), then past meetings newest first. The ones Minutes has split
// into chapters say so; the rest open to their agenda and what was decided, from the records.
export function MeetingList() {
  const meetings = useQuery(api.media.meetingList, {});
  const [now] = useState(() => Date.now());
  const [all, setAll] = useState(false);
  if (meetings === undefined) return <p className="text-[15px] text-muted">Loading meetings…</p>;
  if (!meetings.length) return <p className="text-[15px] text-muted">No meetings have been synced yet.</p>;
  const upcoming = meetings.filter((m) => Date.parse(m.startsAt) > now).reverse();
  const past = meetings.filter((m) => Date.parse(m.startsAt) <= now);
  return (
    <div className="flex flex-col gap-6">
      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-heading" className="flex flex-col gap-2.5">
          <h2 id="upcoming-heading" className="text-xl font-extrabold">
            Coming up
          </h2>
          <Cards meetings={upcoming} upcoming />
        </section>
      )}
      <section aria-labelledby="past-heading" className="flex flex-col gap-2.5">
        <h2 id="past-heading" className="text-xl font-extrabold">
          Past meetings
        </h2>
        <Cards meetings={all ? past : past.slice(0, PAST_SHOWN)} upcoming={false} />
        {!all && past.length > PAST_SHOWN && (
          <button type="button" onClick={() => setAll(true)} className="min-h-11 self-start text-[15px] font-semibold text-link underline underline-offset-[0.18em] hover:text-ink">
            Show all {past.length} past meetings
          </button>
        )}
      </section>
    </div>
  );
}

function Cards({ meetings, upcoming }: { meetings: Meeting[]; upcoming: boolean }) {
  return (
    <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      {meetings.map((m) => (
        <li key={m.eventId}>
          <Link
            href={`/meetings/${m.eventId}`}
            className="flex h-full flex-col gap-1.5 rounded-xl border border-line bg-white p-3.5 text-ink no-underline hover:border-link hover:text-ink"
          >
            <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">
              {new Date(m.startsAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
            </span>
            <span className="text-[17px] font-extrabold leading-tight">{bodyLabel(m.bodyName)}</span>
            <span className="text-[13px] text-muted">
              {m.chapters
                ? `${m.chapters} ${m.chapters === 1 ? "chapter" : "chapters"} · ${SOURCE[m.transcriptSource]}`
                : upcoming
                  ? "Agenda"
                  : "Agenda and what was decided"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
