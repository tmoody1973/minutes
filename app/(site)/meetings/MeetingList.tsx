"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { bodyLabel } from "../../../lib/ui/near";

const SOURCE = { transcript: "Transcript with speakers", captions: "City machine captions", none: "No transcript yet" } as const;

export function MeetingList() {
  const meetings = useQuery(api.media.meetingList, {});
  if (meetings === undefined) return <p className="text-[15px] text-muted">Loading meetings…</p>;
  if (!meetings.length) return <p className="text-[15px] text-muted">No meetings have been made readable yet.</p>;
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
              {m.chapters} {m.chapters === 1 ? "chapter" : "chapters"} · {SOURCE[m.transcriptSource]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
