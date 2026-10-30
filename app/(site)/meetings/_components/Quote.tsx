import { useId, useState } from "react";
import { cleanQuote } from "../../../../lib/media/clean";
import { clock } from "../../../../lib/ui/meeting";

// No Legistar correction list exists yet, so the only edit applied is removing immediately repeated words.
export const NO_CORRECTIONS: ReadonlyMap<string, string> = new Map();

// A transcript quote with the required footer: "Lightly cleaned machine transcript · view raw · watch this moment".
// Long machine sentences are trimmed visually (three lines); "view raw" shows the full turn exactly as transcribed.
export function Quote({ quote, rawTurn, startMs, onWatch }: { quote: string; rawTurn: string; startMs: number; onWatch: (ms: number) => void }) {
  const [raw, setRaw] = useState(false);
  const rawId = useId();
  return (
    <figure className="flex flex-col gap-1.5 rounded-[10px] bg-paper p-3">
      <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">FROM THE TRANSCRIPT · {clock(startMs)}</span>
      <blockquote className="line-clamp-3 text-sm leading-normal">&ldquo;{cleanQuote(quote, NO_CORRECTIONS)}&rdquo;</blockquote>
      <figcaption className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
        <span>Lightly cleaned machine transcript</span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => setRaw(!raw)}
          aria-expanded={raw}
          aria-controls={rawId}
          className="min-h-11 font-semibold text-link underline underline-offset-[0.18em] hover:text-ink"
        >
          view raw
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => onWatch(startMs)} className="min-h-11 font-semibold text-link underline underline-offset-[0.18em] hover:text-ink">
          watch this moment
        </button>
      </figcaption>
      {raw && (
        <p id={rawId} className="whitespace-pre-wrap rounded-md bg-white p-2 text-[13px] text-ink">
          {rawTurn}
        </p>
      )}
    </figure>
  );
}
