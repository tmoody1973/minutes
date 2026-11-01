"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { hearingLabel, kindLabel, placeHeading } from "../../lib/ui/near";
import { useSavedPlace } from "./_components/savedPlace";

const MAX_CARDS = 5;
type Card = { tag: string; title: string; href: string; dot: string };

// "This week at City Hall" (mockup MinPhoneHome): at most five cards, every line from record fields.
// `now` comes from the page at request time, rounded to the hour so the query result can be cached.
export function ThisWeek({ now }: { now: number }) {
  const place = useSavedPlace();
  const week = useQuery(api.week.weekAtCityHall, { now });
  const near = useQuery(api.near.filesNear, place ? { lat: place.lat, lng: place.lng, filter: "upcoming" } : "skip");

  if (week === undefined) return <p className="text-[15px] text-muted">Loading this week…</p>;
  const cards: Card[] = [
    ...(near ?? []).slice(0, 2).map((r) => ({
      tag: `NEAR YOU · ${kindLabel(r.kind)}`,
      title: r.nextHearing ? `${placeHeading(r.title, r.fileNumber)} · ${hearingLabel(r.nextHearing)}` : placeHeading(r.title, r.fileNumber),
      href: `/files/${r.fileNumber}`,
      dot: "bg-amber",
    })),
    ...week.comingUp.map((c) => ({ tag: "COMING UP", title: c.message, href: c.href, dot: "bg-amber" })),
    ...week.decided.map((c) => ({ tag: "DECIDED", title: c.message, href: c.href, dot: "bg-link" })),
  ];
  // One card per file: the first (most local, then soonest) wins.
  const shown = cards.filter((c, i) => cards.findIndex((x) => x.href === c.href) === i).slice(0, MAX_CARDS);

  return (
    <section aria-label="This week at City Hall" className="flex max-w-3xl flex-col gap-2.5">
      <p className="text-[13px] text-muted">
        {shown.length} {shown.length === 1 ? "thing" : "things"} on the zoning and development calendar
        {!place && (
          <>
            {" "}
            · <Link href="/near">Set your address</Link> to see what&apos;s near you
          </>
        )}
      </p>
      {shown.length === 0 ? (
        <p className="text-[15px] text-muted">
          No zoning or development hearings or decisions this week. <Link href="/meetings">Read recent meetings</Link>.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="flex items-start gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-ink no-underline hover:border-link hover:text-ink">
                <span aria-hidden="true" className={`mt-[7px] size-2 flex-none rounded-full ${c.dot}`} />
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">
                    {c.tag}
                    <span className="sr-only">. </span>
                  </span>
                  <span className="text-[15px] font-bold leading-snug">{c.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
