"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { granicusLink } from "../../../../lib/media/review";
import { FollowButton } from "../../_components/FollowButton";
import { PlainCard } from "../../_components/PlainCard";
import { actionText, commentPage, hearingIcs, outlineSvg, purposeLine, sourceDocs, stepDate, tallyText } from "../../../../lib/ui/file";
import { bodyLabel, kindLabel, placeHeading } from "../../../../lib/ui/near";
import { lookup } from "../../../../lib/zoning/glossary";
import { parseZoningChange } from "../../../../lib/zoning/change";

type View = NonNullable<FunctionReturnType<typeof api.files.fileView>>;
type Step = View["timeline"][number];

const FILE_NUMBER = /^\d{5,7}$/;
const card = "rounded-[14px] border border-line bg-white";
const mono = "font-mono text-[11px] font-semibold tracking-[0.08em] text-muted";

export function FileClient() {
  const { file } = useParams<{ file: string }>();
  const valid = FILE_NUMBER.test(file);
  const view = useQuery(api.files.fileView, valid ? { fileNumber: file } : "skip");

  if (valid && view === undefined) return <p className="text-[15px] text-muted" aria-live="polite">Loading file {file}…</p>;
  if (!valid || !view) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold md:text-[32px]">We don&apos;t have that file</h1>
        <p className="max-w-[65ch] text-base text-muted">
          Minutes follows zoning files from Plan Commission to Council. <Link href="/near">Find development near you</Link>.
        </p>
      </div>
    );
  }
  return <FileView view={view} />;
}

// Current time as state, refreshed each minute, so render stays pure and an open page notices a hearing starting.
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function FileView({ view }: { view: View }) {
  const { matter, timeline, parcels } = view;
  const now = useNow();
  const heading = placeHeading(matter.title, matter.fileNumber);
  // Re-checked against the clock: Convex re-runs fileView only when data changes, not as time passes, so a
  // stored `upcoming` can outlive the hearing.
  const next = timeline.find((s): s is Step & { startsAt: string; eventId: number } =>
    s.upcoming && s.startsAt !== undefined && s.eventId !== undefined && Date.parse(s.startsAt) > now,
  );
  const districts = [...new Set(parcels.map((p) => p.alder).filter((a) => a !== null))];
  const label = [kindLabel(parseZoningChange(matter.title).kind), districts.length === 1 && `DISTRICT ${districts[0]}`, `FILE ${matter.fileNumber}`]
    .filter(Boolean)
    .join(" · ");
  const purpose = purposeLine(matter.title);

  return (
    // One column at every width, in the mockup's phone order: reading, tab and screen-reader order all match.
    <div className="flex max-w-3xl flex-col gap-4 md:gap-5">
      <section aria-labelledby="file-heading" className="flex flex-col gap-2">
        <span className={mono}>{label}</span>
        <h1 id="file-heading" className="text-[28px] font-extrabold leading-[1.15] md:text-[32px]">
          {heading}
        </h1>
        <PlainCard kind="file" cardKey={matter.fileNumber} fallback={purpose && <p className="max-w-[65ch] text-[17px] leading-[1.45]">{purpose}</p>} />
        <div>
          <FollowButton kind="file" value={matter.fileNumber} label={heading} text="Follow this file" />
        </div>
        {next ? (
          <a
            href="#next-hearing"
            className="flex min-h-11 items-center gap-2 self-start rounded-2xl bg-amber-bg px-3 text-sm font-bold text-amber-fg no-underline hover:text-ink"
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-amber" />
            Next: {next.body}, {stepDate(next.date, next.startsAt)}
          </a>
        ) : (
          <span className="self-start rounded-2xl bg-map px-3 py-1.5 text-sm font-bold text-ink">{matter.statusName}</span>
        )}
      </section>
      <LotOutline parcels={parcels} heading={heading} />
      <WhatWouldChange title={matter.title} zoningNow={[...new Set(parcels.map((p) => p.zoning).filter((z) => z !== null))]} />
      <Process timeline={timeline} />
      {next && <HowToBeHeard next={next} fileNumber={matter.fileNumber} heading={heading} now={now} />}
      <Sources view={view} />
      <FullRecord view={view} />
    </div>
  );
}

function LotOutline({ parcels, heading }: { parcels: View["parcels"]; heading: string }) {
  const svg = outlineSvg(parcels.map((p) => p.polygon), 358, 170, 16);
  if (!svg) return null;
  return (
    <section aria-label="Where it is" className={`${card} overflow-hidden`}>
      <svg viewBox="0 0 358 170" role="img" aria-label={`Lot outline, ${heading}`} className="block h-auto max-h-56 w-full bg-map">
        {svg.paths.map((d) => (
          <path key={d} d={d} fill="var(--color-tint)" stroke="var(--color-link)" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" />
        ))}
      </svg>
      <p className="border-t border-line px-3.5 py-2.5 text-[13px] text-muted">Lot outline from city property records.</p>
    </section>
  );
}

function WhatWouldChange({ title, zoningNow }: { title: string; zoningNow: string[] }) {
  const to = parseZoningChange(title).to;
  if (!to) return null;
  const proposed = lookup(to);
  const now = zoningNow.length === 1 ? lookup(zoningNow[0]) : null;
  return (
    <section aria-labelledby="change-heading" className={`${card} flex flex-col gap-3 p-4`}>
      <h2 id="change-heading" className="text-[17px] font-extrabold">
        What would change
      </h2>
      <div className="flex items-center gap-2.5">
        {zoningNow.length > 0 && (
          <>
            <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-paper p-2.5">
              <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">ZONED NOW</span>
              <span className="text-[15px] font-bold">{zoningNow.join(", ")}</span>
              {now && <span className="text-[13px] text-muted">{now.term}</span>}
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </>
        )}
        <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-tint p-2.5">
          <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-link">PROPOSED</span>
          <span className="text-[15px] font-bold">{proposed?.code ?? to}</span>
          {proposed && <span className="text-[13px] text-muted">{proposed.term}</span>}
        </div>
      </div>
      {proposed?.plain && <p className="text-[15px] leading-normal">{proposed.plain}</p>}
      {proposed && (
        <a href={proposed.officialUrl} className="flex min-h-11 items-center self-start text-sm font-semibold">
          Read the official definition (Milwaukee Code s. {proposed.section})
        </a>
      )}
    </section>
  );
}

function Process({ timeline }: { timeline: Step[] }) {
  return (
    <section aria-labelledby="process-heading" className={`${card} flex flex-col p-4`}>
      <h2 id="process-heading" className="mb-3 text-[17px] font-extrabold">
        Where it is in the process
      </h2>
      <ol>
        {timeline.map((s, i) => {
          const last = i === timeline.length - 1;
          const nextUp = s.upcoming && !timeline.slice(0, i).some((x) => x.upcoming);
          return (
            <li key={`${s.body}|${s.date}`} className="flex gap-3">
              <div aria-hidden="true" className="flex w-6 flex-none flex-col items-center">
                {s.upcoming ? (
                  <div className={`flex size-6 items-center justify-center rounded-full bg-white ${nextUp ? "border-[3px] border-link" : "border-2 border-quiet"}`}>
                    {nextUp && <div className="size-2 rounded-full bg-link" />}
                  </div>
                ) : (
                  <div className="flex size-6 items-center justify-center rounded-full bg-ink">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  </div>
                )}
                {!last && <div className={`min-h-[18px] flex-1 ${timeline[i + 1].upcoming ? "border-l-2 border-dashed border-quiet" : "w-0.5 bg-ink"}`} />}
              </div>
              <div className={`flex flex-col gap-0.5 ${last ? "" : "pb-3.5"}`}>
                <span className={`text-[15px] font-bold ${nextUp ? "text-link" : ""}`}>{s.body}</span>
                <span className="text-[13px] text-muted">
                  {stepDate(s.date, s.upcoming ? s.startsAt : undefined)} · {actionText(s.actions)}
                  {s.tally && `, ${tallyText(s.tally)}`}
                </span>
                {s.clipId !== undefined && s.videoStartSec !== undefined && (
                  <a href={granicusLink(s.clipId, s.videoStartSec * 1000)} className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch this item
                    <span className="sr-only">
                      : {s.body}, {stepDate(s.date)}
                    </span>
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function HowToBeHeard({
  next,
  fileNumber,
  heading,
  now,
}: {
  next: Step & { startsAt: string; eventId: number };
  fileNumber: string;
  heading: string;
  now: number;
}) {
  const page = commentPage(next.body);
  // Browser-only render (see FileView), so window is defined.
  const ics = hearingIcs({ fileNumber, heading, body: next.body, startsAt: next.startsAt, eventId: next.eventId, pageUrl: window.location.href }, new Date(now));
  return (
    <section id="next-hearing" aria-labelledby="hearing-heading" className={`${card} flex scroll-mt-4 flex-col gap-3 p-4`}>
      {/* The heading promises instructions only when a confirmed city page backs it. */}
      <h2 id="hearing-heading" className="text-[17px] font-extrabold">
        {page ? "How to be heard" : "Next hearing"}
      </h2>
      <p className="text-[15px]">
        {next.body} takes this up on <span className="font-bold text-amber-fg">{stepDate(next.date, next.startsAt)}</span>.
      </p>
      {page && (
        <a href={page.url} className="flex min-h-12 items-center justify-center rounded-xl bg-link px-4 text-base font-bold text-white no-underline hover:bg-ink hover:text-white">
          How to take part, from the city
        </a>
      )}
      <a
        href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
        download={`minutes-file-${fileNumber}-hearing.ics`}
        className="flex min-h-12 items-center justify-center rounded-xl border-[1.5px] border-ink bg-white px-4 text-base font-bold text-ink no-underline hover:bg-paper hover:text-ink"
      >
        Add hearing to calendar
      </a>
    </section>
  );
}

const chip = "inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-3 font-mono text-xs font-semibold no-underline";

function Sources({ view }: { view: View }) {
  const docs = sourceDocs(view.attachments);
  if (!docs.length) return null;
  return (
    <section aria-labelledby="sources-heading" className="flex flex-col gap-2">
      <h2 id="sources-heading" className={mono}>
        SOURCES
      </h2>
      <div className="flex flex-wrap gap-2">
        {docs.map((d) => (
          <a key={d.label} href={d.hyperlink} className={chip}>
            {d.label}
          </a>
        ))}
      </div>
    </section>
  );
}

function FullRecord({ view }: { view: View }) {
  return (
    <details className={`${card} group p-4`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <h2 className="text-[17px] font-extrabold">
          Full record: {view.histories.length} actions, {view.attachments.length} documents
        </h2>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none group-open:rotate-180">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <h3 className={`${mono} mt-3`}>EVERY ACTION, FROM LEGISTAR</h3>
      <ul className="mt-2 flex max-w-[75ch] flex-col gap-1.5 text-[15px]">
        {view.histories.map((h, i) => (
          <li key={i}>
            <span className="text-muted">{stepDate(h.date.slice(0, 10))}</span> · {bodyLabel(h.bodyName)} · {actionText([h.actionName])}
          </li>
        ))}
      </ul>
      <h3 className={`${mono} mt-4`}>DOCUMENTS</h3>
      <ul className="mt-1 flex max-w-[75ch] flex-col">
        {view.attachments.map((a) => (
          <li key={a.hyperlink}>
            <a href={a.hyperlink} className="flex min-h-11 items-center text-[15px] font-semibold">
              {a.name}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
