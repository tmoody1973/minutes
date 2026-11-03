"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { granicusLink } from "../../../../lib/media/review";
import { PlainCard } from "../../_components/PlainCard";
import { downloadCsv } from "../../../../lib/ui/csv";
import { actionText, tallyText } from "../../../../lib/ui/file";
import { chapterResult, chapterTitle, clock, meetingSummary, testimonySpeakers, titleKind, voteRows } from "../../../../lib/ui/meeting";
import { bodyLabel } from "../../../../lib/ui/near";
import { Parts, SourceNote, Transcript } from "../_components/MeetingBits";
import { Quote } from "../_components/Quote";
import { VoteTable } from "../_components/VoteTable";

type View = FunctionReturnType<typeof api.media.meetingView>;
type Chapter = View["chapters"][number];
type Turn = View["turns"][number];
type Event = NonNullable<View["event"]>;

const EVENT_ID = /^\d{1,7}$/;
const card = "rounded-[14px] border border-line bg-white";
const mono = "font-mono text-[11px] font-semibold tracking-[0.08em] text-muted";
const timeButton = "min-h-11 font-mono text-xs font-medium text-link underline underline-offset-[0.18em] hover:text-ink";

export function MeetingClient() {
  const { eventId } = useParams<{ eventId: string }>();
  const item = Number(useSearchParams().get("item")) || null;
  const valid = EVENT_ID.test(eventId);
  const view = useQuery(api.media.meetingView, valid ? { eventId: Number(eventId) } : "skip");

  if (valid && view === undefined) return <p className="text-[15px] text-muted">Loading meeting…</p>;
  if (!valid || !view?.event) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-extrabold md:text-[32px]">We don&apos;t have that meeting</h1>
        <p className="max-w-[65ch] text-base text-muted">
          <Link href="/meetings">See the meetings Minutes has made readable</Link>.
        </p>
      </div>
    );
  }
  return view.chapters.length ? <MeetingView view={view} event={view.event} initialItem={item} /> : <AgendaView view={view} event={view.event} />;
}

function MeetingView({ view, event, initialItem }: { view: View; event: Event; initialItem: number | null }) {
  const { eventId } = useParams<{ eventId: string }>();
  const chapters = view.chapters;
  const initial = chapters.findIndex((c) => c.eventItemId === initialItem);
  // Phone: the open chapter (-1 = none). Laptop: the shown chapter (first playable one when none is open).
  const [open, setOpen] = useState(initial);
  // With none open, show the first chapter the recording can play, not one the video index couldn't place.
  const shown = chapters[open >= 0 ? open : Math.max(0, chapters.findIndex((c) => c.startMs !== null))];
  const [atMs, setAtMs] = useState(initial >= 0 ? (chapters[initial].startMs ?? 0) : 0);
  // Counts seek requests so choosing the same moment again (after scrubbing the player) still reloads it there.
  const [seeks, setSeeks] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const watch = (ms: number) => {
    setAtMs(ms);
    setSeeks((n) => n + 1);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const date = new Date(event.startsAt)
    .toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();

  return (
    // Laptop: the video sits top right and stays in view, with the decision under it; chapters and the transcript run
    // down the left. Phone: video first, then the chapters.
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:items-start md:gap-5 md:[grid-template-areas:'head_head''nav_side''nav_detail'] xl:grid-cols-[15rem_minmax(0,1fr)_26rem] xl:[grid-template-areas:'head_head_head''nav_detail_side']">
      <header className="flex flex-col gap-1 md:[grid-area:head]">
        <span className={mono}>
          {bodyLabel(event.bodyName).toUpperCase()} · {date}
        </span>
        <h1 className="text-[26px] font-extrabold leading-[1.15] md:text-[32px] md:tracking-[-0.01em]">{chapters.length ? `The meeting in ${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"}` : "This meeting"}</h1>
        <p className="max-w-[65ch] text-[15px] text-muted md:text-base">{meetingSummary(view)}</p>
        <SourceNote source={view.transcriptSource} />
        {chapters.some((c) => c.votes.length > 0) && (
          <button
            type="button"
            onClick={() => downloadCsv(`meeting-${eventId}-votes.csv`, voteRows(event.startsAt, event.bodyName, chapters))}
            className="min-h-11 self-start text-sm font-semibold text-link underline underline-offset-[0.18em] hover:text-ink"
          >
            Download votes (CSV)
          </button>
        )}
      </header>

      <nav aria-label="Chapters" className="hidden md:flex md:flex-col md:gap-1.5 md:[grid-area:nav]">
        {chapters.map((c, i) => (
          <button
            key={c.eventItemId}
            type="button"
            onClick={() => {
              setOpen(i);
              requestAnimationFrame(() => headingRef.current?.focus());
            }}
            aria-current={c === shown ? "true" : undefined}
            className={`flex min-h-14 items-center gap-2.5 rounded-[10px] bg-white px-3 py-2.5 text-left ${c === shown ? "border-2 border-link" : "border border-line"}`}
          >
            <ChapterNumber n={i + 1} active={c === shown} />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="text-sm font-bold leading-snug">{titleOf(c)}</span>
              {c.item && chapterResult(c.item) && <span className="text-xs text-muted">{chapterResult(c.item)}</span>}
            </span>
            <span className="font-mono text-[11px] text-muted">{c.startMs === null ? "–" : clock(c.startMs)}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-3.5 md:[grid-area:side] xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <div ref={playerRef} className="flex scroll-mt-4 flex-col gap-1.5">
        <Player event={event} atMs={atMs} seeks={seeks} />
      </div>


      {shown && (
        <aside aria-label="Decision and sources" className="hidden flex-col gap-3.5 md:flex">
          {shown.item?.actionName && (
            <section aria-labelledby="decision-heading" className={`${card} flex flex-col gap-2.5 p-[18px]`}>
              <h2 id="decision-heading" className={mono}>
                DECISION
              </h2>
              <p className="text-xl font-extrabold leading-tight">{chapterResult(shown.item)}</p>
              {shown.votes.length > 0 && <VoteTable votes={shown.votes} />}
            </section>
          )}
          {shown.parts.some((p) => p.kind === "testimony") && (
            <section className={`${card} p-[18px]`} aria-label="Public testimony">
              <Testimony chapter={shown} turns={view.turns} watch={watch} event={event} eventId={eventId} />
            </section>
          )}
          <section aria-labelledby="sources-heading" className="flex flex-col gap-2">
            <h2 id="sources-heading" className={mono}>
              SOURCES
            </h2>
            <div className="flex flex-wrap gap-2">
              {event.agendaUrl && <SourceChip href={event.agendaUrl}>Agenda</SourceChip>}
              {event.minutesUrl && <SourceChip href={event.minutesUrl}>Minutes</SourceChip>}
              {shown.docs.map((d) => (
                <SourceChip key={d.label} href={d.hyperlink}>
                  {d.label}
                </SourceChip>
              ))}
              {shown.item?.fileNumber && <SourceChip href={`/files/${shown.item.fileNumber}`}>File {shown.item.fileNumber}</SourceChip>}
            </div>
          </section>
        </aside>
      )}
      </div>

      <ol aria-label="Chapters" className="flex flex-col gap-2 md:hidden">
        {chapters.map((c, i) => (
          <li key={c.eventItemId} className={`overflow-hidden rounded-xl bg-white ${open === i ? "border-2 border-link" : "border border-line"}`}>
            {/* Accordion pattern: each chapter title is a heading holding its toggle, so the outline reads h1 > h2 > h3. */}
            <h2>
            <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left">
              <ChapterNumber n={i + 1} active={open === i} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold leading-snug">{titleOf(c)}</span>
                {c.item && chapterResult(c.item) && <span className="text-[13px] text-muted">{chapterResult(c.item)}</span>}
              </span>
              <span className="font-mono text-xs text-muted">{c.startMs === null ? "–" : clock(c.startMs)}</span>
            </button>
            </h2>
            {open === i && (
              <div className="flex flex-col gap-4 px-3.5 pb-4">
                <PlainCard kind="chapter" cardKey={`${eventId}:${c.eventItemId}`} />
                <Parts chapter={c} watch={watch} />
                <Testimony chapter={c} turns={view.turns} watch={watch} event={event} eventId={eventId} />
                {c.votes.length > 0 && <VoteTable votes={c.votes} />}
                {c.startMs !== null && (
                  <details className="group" open={view.transcriptSource === "captions"}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden">
                      {view.transcriptSource === "captions" ? "Read the city's machine captions" : "Read the transcript"}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="group-open:rotate-180">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </summary>
                    <Transcript chapter={c} turns={view.turns} source={view.transcriptSource} watch={watch} />
                  </details>
                )}
                {c.item?.fileNumber && <ProjectLink fileNumber={c.item.fileNumber} />}
              </div>
            )}
          </li>
        ))}
      </ol>

      {shown && (
        <section aria-labelledby="chapter-heading" className={`${card} hidden flex-col gap-3 p-[18px] md:flex md:[grid-area:detail]`}>
          <h2 id="chapter-heading" ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-xl font-extrabold">
            {titleOf(shown)}
          </h2>
          <PlainCard kind="chapter" cardKey={`${eventId}:${shown.eventItemId}`} />
          <Parts chapter={shown} watch={watch} />
          <Transcript chapter={shown} turns={view.turns} source={view.transcriptSource} watch={watch} />
        </section>
      )}
    </div>
  );
}

// The city's own player, started at a moment. A new key reloads it there, even for the same moment chosen twice.
function Player({ event, atMs, seeks }: { event: Event; atMs: number; seeks: number }) {
  if (event.clipId === null) return <p className="text-[15px] text-muted">The city has not posted video for this meeting.</p>;
  return (
    <>
      <iframe
        key={`${atMs}-${seeks}`}
        src={granicusLink(event.clipId, atMs)}
        title={`Meeting video from ${clock(atMs)}, City of Milwaukee player`}
        allow="autoplay; fullscreen"
        className="aspect-video w-full rounded-[14px] bg-ink"
      />
      <p className="text-[13px] text-muted">
        Video from the City of Milwaukee.{" "}
        <a href={granicusLink(event.clipId, atMs)} className="inline-flex min-h-11 items-center font-semibold">
          Open in the city&apos;s player
        </a>
      </p>
    </>
  );
}

// A meeting Minutes hasn't split into chapters: the agenda and what was decided, from the city's records alone.
function AgendaView({ view, event }: { view: View; event: Event }) {
  const [at, setAt] = useState({ ms: 0, seeks: 0 });
  const [upcoming] = useState(() => Date.parse(event.startsAt) > Date.now());
  const playerRef = useRef<HTMLDivElement>(null);
  const watch = (ms: number) => {
    setAt((a) => ({ ms, seeks: a.seeks + 1 }));
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const date = new Date(event.startsAt)
    .toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] md:items-start md:gap-x-6 md:gap-y-4">
      <header className="flex flex-col gap-1 md:col-span-2">
        <span className={mono}>
          {bodyLabel(event.bodyName).toUpperCase()} · {date}
        </span>
        <h1 className="text-[26px] font-extrabold leading-[1.15] md:text-[32px] md:tracking-[-0.01em]">{upcoming ? "On the agenda" : "What was decided"}</h1>
        {!upcoming && <p className="max-w-[65ch] text-[15px] text-muted md:text-base">{meetingSummary(view)}</p>}
        <p className="max-w-[65ch] text-[14px] text-muted">
          Minutes hasn&apos;t transcribed this meeting. The agenda, actions and vote counts below come from the city&apos;s records.
        </p>
      </header>
      <div ref={playerRef} className="flex scroll-mt-4 flex-col gap-3 md:sticky md:top-4 md:col-start-2 md:row-start-2">
        {upcoming ? <p className="text-[15px] text-muted">Video is posted by the city after the meeting.</p> : <Player event={event} atMs={at.ms} seeks={at.seeks} />}
        <div className="flex flex-wrap gap-2">
          {event.agendaUrl && <SourceChip href={event.agendaUrl}>Agenda</SourceChip>}
          {event.minutesUrl && <SourceChip href={event.minutesUrl}>Minutes</SourceChip>}
        </div>
      </div>
      <section aria-labelledby="agenda-heading" className="flex flex-col gap-2 md:col-start-1 md:row-start-2">
        <h2 id="agenda-heading" className={mono}>
          AGENDA · {view.agenda.length} {view.agenda.length === 1 ? "FILE" : "FILES"}
        </h2>
        {view.agenda.length ? (
          <ol className="flex flex-col gap-2">
            {view.agenda.map((r) => (
              <li key={r.eventItemId} className={`${card} flex flex-col gap-1 p-3.5`}>
                <span className="text-[15px] font-bold leading-snug">{chapterTitle(r.title, r.fileNumber)}</span>
                <span className="text-[13px] text-muted">
                  {r.actions.length ? `${actionText(r.actions)}${r.tally ? `, ${tallyText(r.tally)}` : ""}` : upcoming ? "On the agenda" : "No action recorded"}
                  {r.mover && ` · Moved by ${r.mover}${r.seconder ? `, seconded by ${r.seconder}` : ""}`}
                </span>
                {r.note && (
                  <details className="text-[14px]">
                    <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-link">What the minutes say</summary>
                    <p className="max-w-[65ch] whitespace-pre-line leading-normal">{r.note}</p>
                  </details>
                )}
                <span className="flex flex-wrap items-center gap-x-4">
                  <Link href={`/files/${r.fileNumber}`} className="flex min-h-11 items-center text-sm font-semibold">
                    {titleKind(r.title) ? `${titleKind(r.title)} · File ${r.fileNumber}` : `File ${r.fileNumber}`}
                  </Link>
                  {!upcoming && r.startSec !== undefined && event.clipId !== null && (
                    <button type="button" onClick={() => watch(r.startSec! * 1000)} className={timeButton}>
                      Watch from {clock(r.startSec * 1000)}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[15px] text-muted">No agenda items with a file are recorded for this meeting yet.</p>
        )}
      </section>
    </div>
  );
}


const titleOf = (c: Chapter) => (c.item ? chapterTitle(c.item.title, c.item.fileNumber) : "") || "Agenda item";

function ChapterNumber({ n, active }: { n: number; active: boolean }) {
  return (
    <span aria-hidden="true" className={`flex size-[26px] flex-none items-center justify-center rounded-full text-[13px] font-bold ${active ? "bg-link text-white" : "bg-map text-ink"}`}>
      {n}
    </span>
  );
}


function Testimony({ chapter, turns, watch, event, eventId }: { chapter: Chapter; turns: Turn[]; watch: (ms: number) => void; event: Event; eventId: string }) {
  if (!chapter.parts.some((p) => p.kind === "testimony")) return null;
  const inChapter = turns.filter((t) => chapter.startMs !== null && t.startMs >= chapter.startMs && t.startMs < (chapter.endMs ?? Infinity));
  const speakers = testimonySpeakers(inChapter, chapter.parts);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[15px] font-extrabold">Who spoke during public testimony</h3>
      {speakers.length === 0 ? (
        <p className="text-sm text-muted">No public speakers were found in the recording of this item.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {speakers.map((s) => (
            <li key={s.turnKey} className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-x-2 text-sm">
                <button type="button" onClick={() => watch(s.startMs)} className={timeButton}>
                  {clock(s.startMs)}
                </button>
                <span className="font-bold">{s.display}</span>
                {s.asHeard && <span className="text-muted">· name as heard</span>}
              </span>
              {s.position && s.positionTurn ? (
                <>
                  <span className="text-sm">Stated position: {s.position.position}</span>
                  <Quote
                    quote={s.position.quote}
                    rawTurn={s.positionTurn.text}
                    startMs={s.positionTurn.startMs}
                    onWatch={watch}
                    cite={{ speaker: s.display, bodyName: event.bodyName, startsAt: event.startsAt, path: `/meetings/${eventId}?item=${chapter.eventItemId}` }}
                  />
                </>
              ) : (
                <span className="text-sm text-muted">Position not stated</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}


function ProjectLink({ fileNumber }: { fileNumber: string }) {
  return (
    <Link href={`/files/${fileNumber}`} className="flex min-h-11 items-center self-start text-sm font-bold">
      See where this file goes next
    </Link>
  );
}

function SourceChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-3 font-mono text-xs font-semibold no-underline">
      {children}
    </a>
  );
}
