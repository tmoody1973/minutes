// Does a stored change concern something a user follows? Pure, so the Watcher's rules are testable offline.
import { distanceMiles, type LatLng } from "../geo/near";
import type { Change, Follow } from "../types";

// Same radius as Near me: an address follow covers files within half a mile.
const ADDRESS_RADIUS_MI = 0.5;

/** What the Watcher knows about the change's file. */
export interface MatterContext {
  fileNumber: string;
  title: string;
  /** Centers of the file's lots (city property records); empty when the title names no lot. */
  centroids: LatLng[];
  /** Alder districts of the file's lots. */
  alders: number[];
}

// Quiet by default (spec): only hearings, decisions and a new file's introduction reach anyone; other steps
// ("published", "signed") are not news on their own. Introduction is the earliest moment to act, weeks before an agenda.
export const alertable = (kind: Change["kind"]) => kind === "hearing_scheduled" || kind === "decision" || kind === "introduced";

// How a file enters City Hall in the records: the Council assigns it to a committee (1,363 of 1,813 files' first
// step, Nov 3, 2026) or the Fire and Police Commission refers it (387). Without a vote, that step is the introduction.
export const isIntroduction = (actionName: string) => /^(ASSIGNED|REFERRED) TO$/i.test(actionName.replace(/\s+/g, " ").trim());

// A concern's watch words (Follow this): lowercase, 3 to 40 characters, distinct, at most 5. Anything else is dropped.
export const MAX_CONCERN_WORDS = 5;
export function concernWords(raw: unknown[]): string[] {
  const words = raw.flatMap((w) => (typeof w === "string" ? [w.replace(/\s+/g, " ").trim().toLowerCase()] : []));
  const kept = [...new Set(words.filter((w) => w.length >= 3 && w.length <= 40))];
  // "proposed 2027 budget" adds nothing once "2027 budget" is watched: any title with the longer has the shorter.
  return kept.filter((w) => !kept.some((o) => o !== w && w.includes(o))).slice(0, MAX_CONCERN_WORDS);
}

function parseLatLng(value: string): LatLng | null {
  const [lat, lng] = value.split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function matchesFollow(_change: Change, follow: Pick<Follow, "kind" | "value">, m: MatterContext): boolean {
  switch (follow.kind) {
    case "file":
      return follow.value === m.fileNumber;
    case "address": {
      const here = parseLatLng(follow.value);
      return !!here && m.centroids.some((c) => distanceMiles(here, c) <= ADDRESS_RADIUS_MI);
    }
    case "alder": {
      const district = Number(follow.value);
      return Number.isInteger(district) && m.alders.includes(district);
    }
    case "topic": {
      // A concern stores its words comma-separated; any one in the title is a match.
      const title = m.title.toLowerCase();
      return follow.value.split(",").some((w) => {
        const word = w.trim().toLowerCase();
        // "readers" also matches "reader": the singular is inside both forms.
        const stem = /[^s]s$/.test(word) ? word.slice(0, -1) : word;
        return stem.length > 0 && title.includes(stem);
      });
    }
  }
}
