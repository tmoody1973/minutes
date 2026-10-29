import type { Turn } from "@/lib/types";

// Matches "HH:MM:SS.mmm --> HH:MM:SS.mmm" and "MM:SS.mmm --> MM:SS.mmm".
// Anything after the end time (cue settings such as align:start) is ignored.
const TIMING = /((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}\.\d{3})/;

// ">>" marks a speaker change in Granicus captions; we keep the words, not the marker.
const SPEAKER_MARKER = /^>>\s*/;

export function vttTimeToMs(stamp: string): number {
  const parts = stamp.split(":");
  const [seconds, millis = "0"] = parts.pop()!.split(".");
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);
  return hours * 3_600_000 + minutes * 60_000 + Number(seconds) * 1000 + Number(millis);
}

// Each cue becomes one turn. Cue index n counts every timed cue in the file,
// including ones skipped for empty text, so turnKeys stay stable.
export function parseVtt(vtt: string, eventId: number): Turn[] {
  const turns: Turn[] = [];
  const blocks = vtt.replace(/\r\n?/g, "\n").split(/\n\s*\n/);

  let n = 0;
  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => TIMING.test(line));
    if (timingIndex === -1) continue;

    const [, start, end] = lines[timingIndex].match(TIMING)!;
    const cueIndex = n++;
    const text = lines
      .slice(timingIndex + 1)
      .map((line) => line.trim())
      .join(" ")
      .trim()
      .replace(SPEAKER_MARKER, "")
      .trim();
    if (text === "") continue;

    turns.push({
      eventId,
      turnKey: `cap:${cueIndex}`,
      chunk: -1,
      startMs: vttTimeToMs(start),
      endMs: vttTimeToMs(end),
      label: null,
      text,
    });
  }
  return turns;
}
