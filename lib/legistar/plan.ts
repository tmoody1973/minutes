// Pure helpers for the sync actions: which dates, filters and ids to ask Legistar for.
const day = (d: Date) => d.toISOString().slice(0, 10);
const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

export function syncWindow(now: Date, daysBack: number, daysAhead: number) {
  return { since: day(shift(now, -daysBack)), until: day(shift(now, daysAhead)) };
}

export function eventsFilter(since: string, until: string, bodyIds: number[]): string {
  const bodies = bodyIds.map((b) => `EventBodyId eq ${b}`).join(" or ");
  return `EventDate ge datetime'${since}' and EventDate le datetime'${until}' and (${bodies})`;
}

export function memberFilter(bodyId: number, today: string): string {
  return `OfficeRecordBodyId eq ${bodyId} and OfficeRecordEndDate ge datetime'${today}'`;
}

export function matterIdsOf(items: { matterId?: number }[]): number[] {
  return [...new Set(items.flatMap((i) => (i.matterId === undefined ? [] : [i.matterId])))];
}

// Items with no action and no result were never voted on; skip their votes call.
export function hasVotes(item: { actionName?: string; passed?: boolean }): boolean {
  return item.actionName !== undefined || item.passed !== undefined;
}

// A matter synced within this window is skipped: shared matters would otherwise be re-fetched once per event.
export const MATTER_FRESH_MS = 20 * 60_000;

export function isMatterFresh(syncedAt: number | null | undefined, now: number): boolean {
  return syncedAt != null && now - syncedAt < MATTER_FRESH_MS;
}
