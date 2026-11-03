import Link from "next/link";
import { Suspense } from "react";
import { DISCLOSURE } from "../../lib/ui/shell";
import { WeekNow } from "./_components/WeekNow";
import { AskForm } from "./ask/AskClient";

// Landing page: Ask first (decision 008), then the real app (this week's cards from live records) one scroll down.
// Numbers come from scripts/metrics.ts (Nov 1, 2026), same as the About page.
const card = "rounded-[14px] border border-line bg-white p-4 md:p-5";
const button = "inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-bold no-underline";

const FEATURES: { title: string; body: string; href: string; link: string }[] = [
  {
    title: "Follow a file from start to finish",
    body: "Every step from introduction through committee and Council to the Mayor's signature, with dates, each vote and the moment in the meeting video.",
    href: "/files/260533",
    link: "See 711 E. Kilbourn Ave.",
  },
  {
    title: "Read a three-hour meeting in three minutes",
    body: "Chapters by agenda item: the presentation, who testified and what they said, and how each member voted.",
    href: "/meetings/13559",
    link: "Open the Sep 28 Plan Commission meeting",
  },
  {
    title: "Hear about it only when it matters",
    body: "Ask about anything, then follow it. Or follow a file, your area or your alderperson. Minutes emails you when a hearing is set or a decision is made, and stays quiet otherwise.",
    href: "/ask",
    link: "Ask, then follow",
  },
];

const PROOF: [string, string][] = [
  ["188", "plain-language summaries, every sentence checked against its record"],
  ["8 of 8", "planted errors caught by the Editor's test"],
  ["8.4 hours", "of meetings transcribed with Meta's Muse Voice Transcribe"],
];

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-8 md:gap-12">
      <section aria-labelledby="hero-heading" className="flex max-w-3xl flex-col gap-5 pt-2 md:pt-8">
        <div className="flex flex-col gap-3">
          <h1 id="hero-heading" className="text-[34px] font-extrabold leading-[1.08] tracking-[-0.015em] md:text-[56px]">
            Ask what Milwaukee City&nbsp;Hall is doing.
          </h1>
          <p className="max-w-[60ch] text-[17px] leading-[1.5] md:text-xl">
            Minutes reads the files, votes and meetings of the Common Council, its committees and commissions, and answers in plain
            words. Every sentence links to the record it came from.
          </p>
        </div>
        <AskForm />
        <p className="max-w-[65ch] rounded-xl bg-tint px-3.5 py-2.5 text-[14px] font-semibold leading-snug">
          {DISCLOSURE} <Link href="/about">How Minutes works</Link>
        </p>
      </section>

      <section aria-labelledby="week-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="week-heading" className="text-xl font-extrabold md:text-2xl">
            This week at City Hall
          </h2>
          <Link href="/week" className="text-[15px] font-semibold">
            All of this week
          </Link>
        </div>
        <Suspense fallback={<p className="text-[15px] text-muted">Loading this week…</p>}>
          <WeekNow compact />
        </Suspense>
      </section>

      <section aria-labelledby="features-heading" className="flex flex-col gap-3">
        <h2 id="features-heading" className="text-xl font-extrabold md:text-2xl">
          What you can do
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className={`${card} flex flex-col gap-2`}>
              <h3 className="text-[17px] font-extrabold leading-snug">{f.title}</h3>
              <p className="flex-1 text-[15px] leading-normal text-muted">{f.body}</p>
              <Link href={f.href} className="min-h-11 content-center text-[15px] font-semibold">
                {f.link}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="proof-heading" className={`${card} flex flex-col gap-4`}>
        <div className="flex flex-col gap-1">
          <h2 id="proof-heading" className="text-xl font-extrabold md:text-2xl">
            Every sentence traces to a public record
          </h2>
          <p className="max-w-[65ch] text-[15px] leading-normal text-muted">
            Meta&rsquo;s Muse Spark writes the plain-language summaries. A separate check, the Editor, sees each sentence with only the
            records it cites and rejects anything they don&rsquo;t state, or any word that takes a side.
          </p>
        </div>
        <dl className="grid gap-3 md:grid-cols-3">
          {PROOF.map(([n, what]) => (
            <div key={what} className="flex flex-col gap-0.5">
              <dt className="sr-only">{what}</dt>
              <dd className="text-3xl font-extrabold">{n}</dd>
              <dd className="text-[14px] leading-snug text-muted">{what}</dd>
            </div>
          ))}
        </dl>
        <Link href="/about" className="min-h-11 content-center self-start text-[15px] font-semibold">
          How Minutes works, and what it can&rsquo;t do yet
        </Link>
      </section>

      <section aria-labelledby="cta-heading" className="flex flex-col items-start gap-3 pb-2">
        <h2 id="cta-heading" className="text-xl font-extrabold md:text-2xl">
          What&rsquo;s proposed on your block?
        </h2>
        <Link href="/near" className={`${button} bg-link text-white hover:bg-ink`}>
          Type your address
        </Link>
      </section>
    </div>
  );
}
