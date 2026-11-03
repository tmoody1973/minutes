"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { WeekItem } from "../../convex/week";
import { TOPICS, type Topic } from "../../lib/topics";
import { hearingLabel, placeHeading } from "../../lib/ui/near";
import { useSavedPlace } from "./_components/savedPlace";

const COMPACT_CARDS = 5;
const SHOWN = 8;
type Week = FunctionReturnType<typeof api.week.weekAtCityHall>;
type Filter = Topic | "all" | "near";

// "This week at City Hall" across every synced body (decision 008): topic chips, then Coming up and Decided.
// Every line comes from record fields. `now` comes from the page at request time, rounded to the hour so the query
// result can be cached. `compact` is the home page's five-card preview.
export function ThisWeek({ now, compact = false }: { now: number; compact?: boolean }) {
  const place = useSavedPlace();
  const week = useQuery(api.week.weekAtCityHall, { now });
  const near = useQuery(api.near.filesNear, place ? { lat: place.lat, lng: place.lng, filter: "upcoming" } : "skip");
  const [filter, setFilter] = useState<Filter>("all");

  if (week === undefined) return <p className="text-[15px] text-muted">Loading this week…</p>;
  const nearItems: WeekItem[] = (near ?? []).map((r) => ({
    href: `/files/${r.fileNumber}`,
    title: placeHeading(r.title, r.fileNumber),
    meta: r.nextHearing ? hearingLabel(r.nextHearing) : undefined,
    topic: "development",
    at: r.nextHearing?.date ?? "",
  }));
  if (compact) return <Compact week={week} nearItems={nearItems} hasPlace={!!place} />;

  const nearHrefs = new Set(nearItems.map((i) => i.href));
  const pick = (items: WeekItem[]) => (filter === "all" ? items : filter === "near" ? items.filter((i) => nearHrefs.has(i.href)) : items.filter((i) => i.topic === filter));
  const comingUp = filter === "near" ? nearItems : pick(week.comingUp);
  const decided = pick(week.decided);
  const what = filter === "all" ? "" : filter === "near" ? " near you" : ` in ${TOPICS[filter].toLowerCase()}`;

  return (
    <section aria-label="This week at City Hall" className="flex max-w-3xl flex-col gap-4">
      <p className="text-[13px] text-muted">
        {count(week.comingUp.length, "file")} on agendas in the next 7 days · {week.decided.length} decided in the last 7, across the Common Council, its
        committees and three commissions.
      </p>
      <TopicChips week={week} filter={filter} setFilter={setFilter} nearCount={place ? nearItems.length : null} />
      <Group key={`up-${filter}`} id="coming-up" heading="On agendas in the next 7 days" items={comingUp} dot="bg-amber" empty={`Nothing on an agenda${what} in the next 7 days.`} />
      <Group key={`dec-${filter}`} id="decided" heading="Decided in the last 7 days" items={decided} dot="bg-link" empty={`Nothing decided${what} in the last 7 days.`} />
      {comingUp.length + decided.length === 0 && (
        <p className="text-[15px] text-muted">
          <Link href="/meetings">Read recent meetings</Link> or <Link href="/">ask about something specific</Link>.
        </p>
      )}
    </section>
  );
}

const count = (n: number, noun: string) => `${n} ${n === 1 ? noun : `${noun}s`}`;
const chip = "inline-flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[14px] font-semibold no-underline";

// Horizontal scroll on a phone; only topics with something this week get a chip.
function TopicChips({ week, filter, setFilter, nearCount }: { week: Week; filter: Filter; setFilter: (f: Filter) => void; nearCount: number | null }) {
  const n = (t: Topic) => week.comingUp.filter((i) => i.topic === t).length + week.decided.filter((i) => i.topic === t).length;
  const topics = (Object.keys(TOPICS) as Topic[]).filter((t) => n(t) > 0);
  const button = (f: Filter, text: string, total: number) => (
    <button
      key={f}
      type="button"
      aria-pressed={filter === f}
      onClick={() => setFilter(f)}
      className={`${chip} ${filter === f ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-link"}`}
    >
      {text} <span className={filter === f ? "text-white/75" : "text-muted"}>{total}</span>
    </button>
  );
  return (
    <div role="group" aria-label="Show a topic" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {button("all", "Everything", week.comingUp.length + week.decided.length)}
      {nearCount === null ? (
        <Link href="/near" className={`${chip} border-line bg-white text-link hover:border-link`}>
          Near you <span className="text-muted">set address</span>
        </Link>
      ) : (
        button("near", "Near you", nearCount)
      )}
      {topics.map((t) => button(t, TOPICS[t], n(t)))}
    </div>
  );
}

function Group({ id, heading, items, dot, empty }: { id: string; heading: string; items: WeekItem[]; dot: string; empty: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-[17px] font-extrabold">
        {heading} <span className="font-semibold text-muted">· {items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-[15px] text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((i) => (
            <li key={i.href}>
              <Card item={i} dot={dot} tag={TOPICS[i.topic]} />
            </li>
          ))}
        </ul>
      )}
      {items.length > shown.length && (
        <button type="button" onClick={() => setAll(true)} className="min-h-11 self-start rounded-xl border-[1.5px] border-link bg-white px-4 text-[15px] font-bold text-link hover:bg-tint">
          Show all {items.length}
        </button>
      )}
    </section>
  );
}

function Card({ item, dot, tag }: { item: WeekItem; dot: string; tag: string }) {
  return (
    <Link href={item.href} className="flex items-start gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-ink no-underline hover:border-link hover:text-ink">
      <span aria-hidden="true" className={`mt-[7px] size-2 flex-none rounded-full ${dot}`} />
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">
          {tag.toUpperCase()}
          <span className="sr-only">. </span>
        </span>
        <span className="line-clamp-3 text-[15px] font-bold leading-snug">{item.title}</span>
        {item.meta && <span className="text-[13px] text-muted">{item.meta}</span>}
      </span>
    </Link>
  );
}

// Home page preview: near you first, then soonest coming up, then latest decided; one card per file.
function Compact({ week, nearItems, hasPlace }: { week: Week; nearItems: WeekItem[]; hasPlace: boolean }) {
  const cards = [
    ...nearItems.slice(0, 2).map((item) => ({ item, dot: "bg-amber", tag: "Near you" })),
    ...oneTopicEach(week.comingUp).map((item) => ({ item, dot: "bg-amber", tag: TOPICS[item.topic] })),
    ...week.decided.map((item) => ({ item, dot: "bg-link", tag: TOPICS[item.topic] })),
  ];
  const shown = cards.filter((c, i) => cards.findIndex((x) => x.item.href === c.item.href) === i).slice(0, COMPACT_CARDS);
  return (
    <div className="flex max-w-3xl flex-col gap-2.5">
      <p className="text-[13px] text-muted">
        {count(week.comingUp.length, "file")} on agendas this week · {week.decided.length} decided
        {!hasPlace && (
          <>
            {" "}
            · <Link href="/near">Set your address</Link> to see what&apos;s near you
          </>
        )}
      </p>
      {shown.length === 0 ? (
        <p className="text-[15px] text-muted">
          Nothing on an agenda or decided this week. <Link href="/meetings">Read recent meetings</Link>.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((c) => (
            <li key={c.item.href}>
              <Card item={c.item} dot={c.dot} tag={c.tag} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The soonest file from each topic first, then the rest in order: the preview shows the breadth of the week.
function oneTopicEach(items: WeekItem[]): WeekItem[] {
  const firsts = items.filter((i, n) => items.findIndex((x) => x.topic === i.topic) === n);
  return [...firsts, ...items.filter((i) => !firsts.includes(i))];
}
