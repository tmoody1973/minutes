// Meeting page pieces that carry the required states (Review Focus 4), kept apart so tests can render them.
import { cleanQuote } from "../../../../lib/media/clean";
import { clock, PART_LABELS } from "../../../../lib/ui/meeting";
import { NO_CORRECTIONS } from "./Quote";

export type TranscriptSource = "transcript" | "captions" | "none";
export type ChapterLike = {
  located: string;
  startMs: number | null;
  endMs: number | null;
  parts: { kind: string; startMs: number; endMs: number }[];
};
export type TurnLike = { turnKey: string; startMs: number; text: string; display: string; asHeard: boolean };

const timeButton = "min-h-11 font-mono text-xs font-medium text-link underline underline-offset-[0.18em] hover:text-ink";

export function SourceNote({ source }: { source: TranscriptSource }) {
  if (source === "transcript") return <p className="max-w-[65ch] text-[13px] text-muted">Speaker names come from the roll call, the agenda and self-introductions; anyone not confirmed shows as a letter.</p>;
  if (source === "captions") return <p className="text-[13px] font-semibold text-muted">City machine captions: rough text with no speaker names.</p>;
  return <p className="text-[13px] font-semibold text-muted">No transcript yet.</p>;
}

export function Parts({ chapter, watch }: { chapter: ChapterLike; watch: (ms: number) => void }) {
  if (chapter.located === "not-located" || chapter.startMs === null) {
    return <p className="text-[15px] text-muted">We couldn&apos;t find this item in the recording.</p>;
  }
  const parts = chapter.parts.length ? chapter.parts : [{ kind: "start", startMs: chapter.startMs, endMs: chapter.endMs ?? chapter.startMs }];
  return (
    <ul aria-label="Parts of this item" className="flex flex-col">
      {parts.map((p) => (
        <li key={`${p.kind}${p.startMs}`} className="border-b border-map last:border-b-0">
          <button type="button" onClick={() => watch(p.startMs)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm hover:text-link">
            <span>{PART_LABELS[p.kind] ?? "Jump to the start of this item"}</span>
            <span className="font-mono text-xs text-link">{clock(p.startMs)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Transcript({ chapter, turns, source, watch }: { chapter: ChapterLike; turns: TurnLike[]; source: TranscriptSource; watch: (ms: number) => void }) {
  if (chapter.startMs === null) return null;
  const rows = turns.filter((t) => t.startMs >= chapter.startMs! && t.startMs < (chapter.endMs ?? Infinity));
  if (!rows.length) return <p className="text-[15px] text-muted">No transcript yet.</p>;
  return (
    <div className="flex flex-col">
      <h3 className="mb-1 text-[13px] text-muted">{source === "captions" ? "City machine captions" : "Lightly cleaned machine transcript"}</h3>
      <ol className="max-h-[70vh] overflow-y-auto">
        {rows.map((t) => (
          <li key={t.turnKey} className="flex gap-3.5 border-t border-map py-2.5">
            <button type="button" onClick={() => watch(t.startMs)} className={`${timeButton} w-16 flex-none self-start text-left`}>
              {clock(t.startMs)}
            </button>
            <div className="flex max-w-[70ch] flex-col gap-0.5">
              <span className="text-sm font-bold">
                {t.display}
                {t.asHeard && <span className="font-medium text-muted"> · name as heard</span>}
              </span>
              <span className="text-[15px] leading-normal">{cleanQuote(t.text, NO_CORRECTIONS)}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
