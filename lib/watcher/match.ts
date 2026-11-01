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

// Quiet by default (spec): only hearings and decisions reach anyone; an added step is not news on its own.
export const alertable = (kind: Change["kind"]) => kind === "hearing_scheduled" || kind === "decision";

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
      const topic = follow.value.trim().toLowerCase();
      return topic.length > 0 && m.title.toLowerCase().includes(topic);
    }
  }
}
