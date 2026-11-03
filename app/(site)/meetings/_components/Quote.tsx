import { useEffect, useId, useState } from "react";
import { cleanQuote } from "../../../../lib/media/clean";
import { clock, quoteCitation } from "../../../../lib/ui/meeting";

// No Legistar correction list exists yet, so the only edit applied is removing immediately repeated words.
export const NO_CORRECTIONS: ReadonlyMap<string, string> = new Map();

// A transcript quote with the required footer: "Lightly cleaned machine transcript · view raw · watch this moment".
// Long machine sentences are trimmed visually (three lines); "view raw" shows the full turn exactly as transcribed.
// "copy citation" copies the cleaned words (not the raw turn) with who said them, where, and a link back.
export function Quote({ quote, rawTurn, startMs, onWatch, cite }: {
  quote: string;
  rawTurn: string;
  startMs: number;
  onWatch: (ms: number) => void;
  /** Who and where, for the citation; `path` is the meeting page with the chapter open. */
  cite: { speaker: string; bodyName: string; startsAt: string; path: string };
}) {
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState("");
  const rawId = useId();
  const cleaned = cleanQuote(quote, NO_CORRECTIONS);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(""), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = async () => {
    const text = quoteCitation({ ...cite, quote: cleaned, startMs, url: `${window.location.origin}${cite.path}` });
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied");
    } catch {
      setCopied("Couldn't copy");
    }
  };
  return (
    <figure className="flex flex-col gap-1.5 rounded-[10px] bg-paper p-3">
      <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">FROM THE TRANSCRIPT · {clock(startMs)}</span>
      <blockquote className="line-clamp-3 text-sm leading-normal">&ldquo;{cleaned}&rdquo;</blockquote>
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
        <span aria-hidden="true">·</span>
        <button type="button" onClick={copy} className="min-h-11 font-semibold text-link underline underline-offset-[0.18em] hover:text-ink">
          copy citation
        </button>
        <span role="status" className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">
          {copied}
        </span>
      </figcaption>
      {raw && (
        <p id={rawId} className="whitespace-pre-wrap rounded-md bg-white p-2 text-[13px] text-ink">
          {rawTurn}
        </p>
      )}
    </figure>
  );
}
