import type { Turn } from "@/lib/types";

export type RawTurn = {
  turnId: string | number;
  startMs: number;
  endMs: number;
  transcript: string;
  speaker?: string;
};

type Chunk = { index: number; offsetMs: number; turns: RawTurn[] };

type Indexed = { turn: Turn; order: number };

// Puts chunk-relative turns on one meeting timeline. Labels are namespaced by
// chunk so "A" in chunk 3 never merges with "A" in chunk 4.
export function stitchChunks(eventId: number, chunks: Chunk[]): Turn[] {
  const indexed: Indexed[] = [];
  for (const chunk of chunks) {
    for (const raw of chunk.turns) {
      const text = raw.transcript.trim();
      if (text === "") continue;
      const order = indexed.length;
      indexed.push({
        order,
        turn: {
          eventId,
          turnKey: `${chunk.index}:${raw.turnId}`,
          chunk: chunk.index,
          startMs: chunk.offsetMs + raw.startMs,
          endMs: chunk.offsetMs + raw.endMs,
          label: raw.speaker ? `c${chunk.index}:${raw.speaker}` : null,
          text,
        },
      });
    }
  }
  return indexed
    .sort(
      (a, b) =>
        a.turn.startMs - b.turn.startMs ||
        a.turn.chunk - b.turn.chunk ||
        a.order - b.order,
    )
    .map((entry) => entry.turn);
}
