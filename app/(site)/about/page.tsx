import type { Metadata } from "next";
import Link from "next/link";
import { DISCLOSURE } from "../../../lib/ui/shell";
import { PageIntro } from "../_components/PageIntro";

export const metadata: Metadata = { title: "About" };

const card = "rounded-[14px] border border-line bg-white p-4 md:p-5";
const mono = "font-mono text-[11px] font-semibold tracking-[0.08em] text-muted";
const h2 = "text-[17px] font-extrabold md:text-xl";

// The pipeline, left to right (top to bottom on a phone). Every number here comes from scripts/metrics.ts or the
// DEVLOG (Nov 1, 2026); update both together.
const STAGES: { label: string; title: string; items: string[] }[] = [
  {
    label: "1 · PUBLIC RECORDS",
    title: "What the city publishes",
    items: [
      "Legistar: files, agendas, actions and each member's vote",
      "Meeting video from the city's video archive",
      "Property records and parcel map for each lot",
      "Zoning code, chapter 295, for official definitions",
    ],
  },
  {
    label: "2 · CODE, NO AI",
    title: "Copied and connected",
    items: [
      "Synced every 30 minutes, plus a full pass each night",
      "One timeline per file, from Council introduction to the Mayor",
      "Lots outlined from property records",
      "Vote counts computed from each member's vote",
    ],
  },
  {
    label: "3 · META MODELS",
    title: "Listened to and read",
    items: [
      "Muse Voice Transcribe turns meeting audio into a transcript with speaker labels",
      "Muse Spark confirms speaker names found in the roll call and introductions",
      "Muse Spark splits each agenda item into presentation, testimony, discussion and vote",
      "Muse Spark answers questions by looking up the records with tools (Ask Minutes)",
      "Muse Spark writes plain-language summaries, and a second Muse Spark check (the Editor) approves each sentence",
    ],
  },
  {
    label: "4 · WHAT YOU SEE",
    title: "Minutes",
    items: [
      "Ask Minutes: plain answers, every sentence linked to its record",
      "File pages: where a file is in the process and how to be heard",
      "Meetings as chapters you can jump to in the video",
      "Near me: what is proposed within half a mile",
      "Following: an email only when something you follow is introduced, scheduled or decided",
    ],
  },
];

const NUMBERS: [string, string][] = [
  ["8.4 hours", "of meetings transcribed (4 meetings)"],
  ["$0.18", "per hour of audio to transcribe"],
  ["1,817", "city files synced"],
  ["181", "files followed across Plan Commission, committee and Council"],
  ["188", "plain-language summaries, every sentence checked"],
  ["8 of 8", "planted errors caught in the Editor's test"],
];

export default function AboutPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-5 md:gap-7">
      <PageIntro title="About Minutes">Milwaukee City Hall&rsquo;s public records, readable by anyone, at the depth they choose.</PageIntro>

      <section aria-labelledby="disclosure-heading" className="rounded-[14px] border-2 border-link bg-tint p-4 md:p-5">
        <h2 id="disclosure-heading" className={mono}>
          WHO BUILT THIS
        </h2>
        <p className="mt-1.5 text-[17px] font-bold leading-snug">{DISCLOSURE}</p>
        <p className="mt-2 max-w-[65ch] text-[15px] leading-normal">
          Neutrality is built into the product: Minutes shows records, never recommendations, and every member&rsquo;s votes and
          statements appear exactly the same way.
        </p>
      </section>

      <section aria-labelledby="problem-heading" className="flex flex-col gap-2">
        <h2 id="problem-heading" className={h2}>
          The problem
        </h2>
        <div className="flex max-w-[65ch] flex-col gap-3 text-[17px] leading-[1.5]">
          <p>
            Milwaukee publishes almost everything City Hall decides: proposals, staff reports, agendas, votes and hours of meeting
            video. Almost nobody can use it. One file&rsquo;s records are spread across a committee, the full Common Council and
            sometimes a commission. Meetings run three hours. Nothing tells you which files touch what you care about, when they will
            be heard, or how to speak up before it is decided.
          </p>
          <p>
            Minutes covers the Common Council, its committees and the City Plan, Fire &amp; Police and Historic Preservation
            commissions. Ask it a question and it answers from the records. It follows each file from start to finish, turns meetings
            into chapters you can read or jump to, shows what is proposed near you, and emails you when something you follow is
            scheduled or decided. Plain words, with the official record one tap away.
          </p>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="flex flex-col gap-3">
        <h2 id="how-heading" className={h2}>
          How it works
        </h2>
        <p className="max-w-[65ch] text-[15px] leading-normal text-muted">
          Code handles the facts; Meta&rsquo;s models handle listening and plain language; nothing a model writes is shown until it is
          checked against the records.
        </p>
        <figure className="flex flex-col gap-2">
          <ol aria-label="How records become Minutes" className="grid gap-2 md:grid-cols-4 md:gap-0">
            {STAGES.map((s, i) => (
              <li key={s.label} className="flex flex-col md:flex-row">
                <div className={`${i === 3 ? "border-2 border-link" : "border border-line"} flex flex-1 flex-col gap-2 rounded-[14px] bg-white p-4`}>
                  <span className={mono}>{s.label}</span>
                  <span className="text-base font-extrabold leading-snug">{s.title}</span>
                  <ul className="flex flex-col gap-1.5 text-[14px] leading-snug">
                    {s.items.map((it) => (
                      <li key={it} className="flex gap-2">
                        <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-quiet" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
                {i < STAGES.length - 1 && <Arrow />}
              </li>
            ))}
          </ol>
          <figcaption className="text-[13px] text-muted">From the city&rsquo;s public records to what you see, left to right.</figcaption>
        </figure>
      </section>

      <section aria-labelledby="editor-heading" className={`${card} flex flex-col gap-3`}>
        <h2 id="editor-heading" className={h2}>
          How a sentence gets on the page
        </h2>
        <ol className="grid gap-3 text-[15px] leading-normal md:grid-cols-4">
          {[
            ["Gather", "Code collects the records for one file or chapter, each with its own label."],
            ["Write", "Muse Spark drafts one or two plain sentences and names the records behind each one."],
            ["Check", "The Editor sees one sentence and only its records. It rejects anything they don't state, and any judging word."],
            ["Show", "Only approved sentences are saved, dated, with their sources listed underneath."],
          ].map(([t, d], i) => (
            <li key={t} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 font-extrabold">
                <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-tint font-mono text-xs text-link">
                  {i + 1}
                </span>
                {t}
              </span>
              <span className="text-muted">{d}</span>
            </li>
          ))}
        </ol>
        <p className="max-w-[65ch] text-[14px] leading-normal">
          A real rejection: &ldquo;The city parking lot would be&hellip; sold to Vliet Street Lofts, LLC.&rdquo; The records authorize
          accepting an offer; they don&rsquo;t say a sale happened, so the sentence never appeared.
        </p>
      </section>

      <section aria-labelledby="numbers-heading" className="flex flex-col gap-3">
        <h2 id="numbers-heading" className={h2}>
          By the numbers
        </h2>
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {NUMBERS.map(([n, what]) => (
            <div key={what} className={`${card} flex flex-col gap-0.5`}>
              <dt className="sr-only">{what}</dt>
              <dd className="text-2xl font-extrabold">{n}</dd>
              <dd className="text-[13px] leading-snug text-muted">{what}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] text-muted">As of Nov 3, 2026.</p>
      </section>

      <section aria-labelledby="limits-heading" className="flex flex-col gap-2">
        <h2 id="limits-heading" className={h2}>
          What Minutes can&rsquo;t do yet
        </h2>
        <ul className="flex max-w-[65ch] list-disc flex-col gap-1.5 pl-5 text-[15px] leading-normal">
          <li>Many speakers in meeting transcripts are not yet named; anyone not confirmed shows as a letter (&ldquo;Speaker B&rdquo;).</li>
          <li>About half of meeting chapters can jump straight to their moment in the video; the rest link to the full recording.</li>
          <li>Transcripts are machine-made and lightly cleaned. Quotes link to the moment in the video so you can hear them yourself.</li>
          <li>Summaries are dated and refreshed by hand, so the city&rsquo;s own record is always the final word.</li>
          <li>Ask Minutes finds files by the words in their titles. If an answer comes back empty, try other words for the same thing.</li>
          <li>Minutes never submits comments for you. &ldquo;How to be heard&rdquo; links to the city&rsquo;s own instructions.</li>
        </ul>
      </section>

      <section aria-labelledby="built-heading" className="flex flex-col gap-2">
        <h2 id="built-heading" className={h2}>
          Built with
        </h2>
        <p className="max-w-[65ch] text-[15px] leading-normal">
          Meta&rsquo;s Muse Voice Transcribe and Muse Spark, through the Meta Model API. Next.js on Vercel, Convex for data and scheduled
          jobs, Clerk for sign-in, Resend for alert email. Code written with Claude Code for the Meta Global AI Developer Hackathon,
          October&ndash;November 2026.
        </p>
        <p className="text-[15px]">
          <Link href="/ask">Ask a question</Link> &middot; <Link href="/near">See what&rsquo;s proposed near you</Link> &middot;{" "}
          <Link href="/meetings">Read a meeting</Link>
        </p>
      </section>
    </div>
  );
}

// Right on a laptop, down on a phone.
function Arrow() {
  return (
    <span aria-hidden="true" className="grid place-items-center py-1 text-link md:px-1.5 md:py-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="rotate-90 md:rotate-0">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}
