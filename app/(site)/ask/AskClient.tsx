"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Answer } from "../../../lib/ask/agent";

// Questions answered from the records during testing (Nov 2, 2026); never invented.
export const EXAMPLES = [
  "What has the city done about police surveillance cameras?",
  "Where is the 2027 city budget in the process?",
  "What's happening with liquor licenses this month?",
];

// The home box hands its question to /ask in memory, never in the URL: a question can hold a home address, and
// URLs land in server request logs.
let pending: string | null = null;

const card = "rounded-xl border border-line bg-white";
const button =
  "inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-bold";

export function AskForm({
  onAsk,
  autoFocus = false,
  initial = "",
  busy = false,
}: {
  onAsk?: (q: string) => void;
  autoFocus?: boolean;
  initial?: string;
  busy?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const submit = (q: string) => {
    const question = q.trim();
    if (question.length < 3) return;
    if (onAsk) return onAsk(question);
    pending = question;
    router.push("/ask");
  };
  return (
    <div className="flex flex-col gap-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="ask-box" className="text-[15px] font-bold">
          Ask about Milwaukee City Hall
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="ask-box"
            autoFocus={autoFocus}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder="The budget, police cameras, a bar license…"
            className="min-h-12 flex-1 rounded-xl border-[1.5px] border-line bg-white px-3.5 text-base outline-none placeholder:text-muted focus:border-link"
          />
          <button
            type="submit"
            disabled={busy || text.trim().length < 3}
            className={`${button} bg-link text-white hover:bg-ink disabled:bg-line disabled:text-muted`}
          >
            {busy ? "Asking…" : "Ask"}
          </button>
        </div>
        <p className="text-[13px] text-muted">
          Answers come only from city records, and Minutes doesn&rsquo;t save
          your question.
        </p>
      </form>
      {!initial && (
        <ul aria-label="Example questions" className="flex flex-wrap gap-2">
          {EXAMPLES.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => submit(q)}
                className="min-h-11 rounded-xl border border-line bg-white px-3.5 py-2 text-left text-[14px] font-semibold leading-snug text-link hover:border-link"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Run =
  | { state: "idle" }
  | { state: "working"; question: string; steps: string[] }
  | { state: "done"; question: string; steps: string[]; answer: Answer }
  | { state: "error"; question: string; steps: string[]; message: string };

async function ask(
  question: string,
  onStep: (s: string) => void,
): Promise<Answer> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? "Minutes couldn't finish this answer. Try again.",
    );
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as
        | { type: "step"; text: string }
        | { type: "answer"; answer: Answer }
        | { type: "error"; message: string };
      if (msg.type === "step") onStep(msg.text);
      else if (msg.type === "answer") return msg.answer;
      else throw new Error(msg.message);
    }
  }
  throw new Error("Minutes couldn't finish this answer. Try again.");
}

// Runs one question; `isCurrent` drops updates from a question that a newer one replaced.
function fetchRun(
  question: string,
  setRun: (r: Run) => void,
  isCurrent: () => boolean,
) {
  const steps: string[] = [];
  ask(question, (s) => {
    steps.push(s);
    if (isCurrent()) setRun({ state: "working", question, steps: [...steps] });
  })
    .then(
      (answer) =>
        isCurrent() &&
        setRun({ state: "done", question, steps: [...steps], answer }),
    )
    .catch(
      (e: unknown) =>
        isCurrent() &&
        setRun({
          state: "error",
          question,
          steps: [...steps],
          message: e instanceof Error ? e.message : String(e),
        }),
    );
}

export function AskClient() {
  // A question handed over from the home box: read once here, run once below, then forgotten.
  const [handed] = useState(() => pending);
  const [run, setRun] = useState<Run>(() =>
    handed
      ? { state: "working", question: handed, steps: [] }
      : { state: "idle" },
  );
  const runId = useRef(0);
  const answerHeading = useRef<HTMLHeadingElement>(null);

  const start = (question: string) => {
    const id = ++runId.current;
    setRun({ state: "working", question, steps: [] });
    fetchRun(question, setRun, () => runId.current === id);
  };

  useEffect(() => {
    pending = null;
    if (!handed || runId.current) return;
    const id = ++runId.current;
    fetchRun(handed, setRun, () => runId.current === id);
  }, [handed]);

  // Bring the question and its steps into view as soon as a run starts (on a phone they start below the fold), then
  // move focus to it when the answer lands so a screen reader reads on from there.
  useEffect(() => {
    if (run.state === "working")
      answerHeading.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    if (run.state === "done" || run.state === "error")
      answerHeading.current?.focus({ preventScroll: true });
  }, [run.state]);

  const question = run.state === "idle" ? "" : run.question;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AskForm
        key={question}
        onAsk={start}
        autoFocus={run.state === "idle"}
        initial={question}
        busy={run.state === "working"}
      />

      {run.state !== "idle" && (
        <section
          aria-labelledby="answer-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="answer-heading"
            ref={answerHeading}
            tabIndex={-1}
            className="text-[22px] font-extrabold leading-tight outline-none md:text-[28px] md:tracking-[-0.01em]"
          >
            {run.question}
          </h2>
          <Steps steps={run.steps} working={run.state === "working"} />
          {run.state === "error" && (
            <div
              role="alert"
              className={`${card} flex flex-col items-start gap-2 p-4`}
            >
              <p className="text-[15px]">{run.message}</p>
              <button
                type="button"
                onClick={() => start(run.question)}
                className={`${button} border-[1.5px] border-link bg-white text-link hover:bg-tint`}
              >
                Try again
              </button>
            </div>
          )}
          {run.state === "done" && <AnswerView answer={run.answer} />}
        </section>
      )}
    </div>
  );
}

// The agent's lookups in plain words; the last one is in progress while it works.
function Steps({ steps, working }: { steps: string[]; working: boolean }) {
  if (!steps.length && !working) return null;
  const shown = working
    ? [
        ...steps,
        steps.length ? "Thinking about what the records say" : "Starting",
      ]
    : steps;
  return (
    <ol
      role="status"
      aria-live="polite"
      aria-label="What Minutes looked up"
      className="flex flex-col gap-1.5 text-[14px] text-muted"
    >
      {shown.map((s, i) => {
        const active = working && i === shown.length - 1;
        return (
          <li key={`${i}-${s}`} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-[3px] grid size-4 flex-none place-items-center"
            >
              {active ? (
                <span className="size-3 rounded-full border-2 border-line border-t-link motion-safe:animate-spin" />
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-link"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </span>
            <span className={active ? "text-ink" : undefined}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

function AnswerView({ answer }: { answer: Answer }) {
  const { sentences, rejected, records } = answer;
  return (
    <div className="flex flex-col gap-5 transition-[opacity,translate] duration-500 ease-out starting:translate-y-1 starting:opacity-0">
      {sentences.length ? (
        <div className="flex flex-col gap-3">
          {sentences.map((s, i) => (
            <p key={i} className="max-w-[65ch] text-[17px] leading-[1.55]">
              {s.text}{" "}
              {uniqueSources(s.sources).map((r) => (
                <Link
                  key={r.key}
                  href={r.href}
                  className="mr-1 inline-flex min-h-7 items-center whitespace-nowrap rounded-full bg-tint px-2.5 align-[2px] text-[12px] font-semibold text-link no-underline hover:bg-link hover:text-white"
                >
                  {r.label}
                </Link>
              ))}
            </p>
          ))}
          <p className="max-w-[65ch] text-[13px] leading-normal text-muted">
            Each sentence was checked by the Editor, a separate Muse Spark
            review that sees only the records the sentence cites.
            {rejected > 0 &&
              ` ${rejected} ${rejected === 1 ? "sentence didn't" : "sentences didn't"} pass and ${rejected === 1 ? "was" : "were"} left out.`}
          </p>
        </div>
      ) : (
        <div className={`${card} flex flex-col gap-1.5 p-4`}>
          <p className="text-[17px] font-bold">
            The records Minutes has don&rsquo;t answer this.
          </p>
          <p className="max-w-[65ch] text-[15px] leading-normal text-muted">
            Minutes covers files and meetings of the Common Council, its
            committees, and the City Plan, Fire &amp; Police and Historic
            Preservation commissions since January 2026. Try other words, or
            search the city&rsquo;s own{" "}
            <a href="https://milwaukee.legistar.com/Legislation.aspx">
              legislation records
            </a>
            .
          </p>
        </div>
      )}

      {records.length > 0 && (
        <section
          aria-labelledby="records-heading"
          className="flex flex-col gap-2"
        >
          <h2 id="records-heading" className="text-[17px] font-extrabold">
            {sentences.length ? "The records" : "Closest records"}
          </h2>
          <ul className={`${card} flex flex-col divide-y divide-line`}>
            {records.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="flex min-h-11 flex-col gap-0.5 px-3.5 py-2.5 text-ink no-underline hover:bg-tint hover:text-ink"
                >
                  <span className="text-[15px] font-bold leading-snug">
                    {r.label}
                  </span>
                  <span className="line-clamp-2 text-[13px] leading-snug text-muted">
                    {r.text.replace(/^File \S+ \([^)]*\):\s*/, "")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const uniqueSources = (rs: Answer["records"]) =>
  rs.filter((r, i) => rs.findIndex((x) => x.label === r.label) === i);
