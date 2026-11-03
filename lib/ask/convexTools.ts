import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Tools } from "./agent";

const HOUR_MS = 3_600_000;

// Ask Minutes' tools, read from Minutes' synced copy of the records (public queries in convex/ask.ts).
export function convexTools(client: ConvexHttpClient, now = Date.now()): Tools {
  return {
    find_files: (q) => client.query(api.ask.findFiles, { q }),
    read_file: (fileNumber) => client.query(api.ask.fileRecords, { fileNumber }),
    find_moments: (q) => client.query(api.ask.findMoments, { q }),
    // Rounded to the hour so the query result can be cached.
    upcoming: (days) => client.query(api.ask.upcoming, { now: Math.floor(now / HOUR_MS) * HOUR_MS, days }),
  };
}
