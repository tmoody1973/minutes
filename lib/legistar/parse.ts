import type { EventItemRecord, EventRecord, HistoryRecord, MatterRecord, VoteRecord } from "@/lib/types";

// Legistar rows are loosely typed JSON; each parser reads only the fields it needs.
type Raw = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const passedFlag = (v: unknown): boolean | undefined =>
  v === "Pass" ? true : v === "Fail" ? false : undefined;

const CHICAGO = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  timeZoneName: "longOffset",
});

// "-05:00" style offset for a Chicago wall-clock time (handles DST).
function chicagoOffset(date: string, hh: number, mm: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  // Guess the instant as if the wall time were UTC, read the offset there, and
  // re-read at the corrected instant so times near a DST switch resolve.
  const wallAsUtc = Date.UTC(y, mo - 1, d, hh, mm);
  const at = (ms: number) =>
    CHICAGO.formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")!.value.replace("GMT", "");
  const toMs = (off: string) => {
    const m = /^([+-])(\d{2}):(\d{2})$/.exec(off);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000 : 0;
  };
  const first = at(wallAsUtc);
  return at(wallAsUtc - toMs(first));
}

function startsAt(eventDate: string, eventTime: unknown): string {
  const date = eventDate.slice(0, 10);
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(str(eventTime) ?? "");
  let hh = 0;
  let mm = 0;
  if (m) {
    hh = Number(m[1]) % 12 + (m[3].toUpperCase() === "PM" ? 12 : 0);
    mm = Number(m[2]);
  }
  const hhmm = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  return `${date}T${hhmm}:00${chicagoOffset(date, hh, mm)}`;
}

export function parseEvent(raw: Raw): EventRecord {
  const clip = Number(raw.EventMedia);
  return {
    legistarId: raw.EventId as number,
    bodyId: raw.EventBodyId as number,
    bodyName: raw.EventBodyName as string,
    startsAt: startsAt(raw.EventDate as string, raw.EventTime),
    clipId: clip > 0 ? clip : undefined,
    agendaUrl: str(raw.EventAgendaFile),
    minutesUrl: str(raw.EventMinutesFile),
    insiteUrl: str(raw.EventInSiteURL),
  };
}

export function parseEventItem(raw: Raw): EventItemRecord {
  return {
    legistarId: raw.EventItemId as number,
    eventId: raw.EventItemEventId as number,
    sequence: num(raw.EventItemAgendaSequence) ?? null,
    matterId: num(raw.EventItemMatterId),
    fileNumber: str(raw.EventItemMatterFile),
    title: (raw.EventItemTitle as string | null) ?? "",
    actionName: str(raw.EventItemActionName),
    passed: passedFlag(raw.EventItemPassedFlagName),
    videoStartSec: num(raw.EventItemVideoIndex),
    mover: str(raw.EventItemMover),
    seconder: str(raw.EventItemSeconder),
  };
}

export function parseMatter(raw: Raw): MatterRecord {
  return {
    legistarId: raw.MatterId as number,
    fileNumber: raw.MatterFile as string,
    title: raw.MatterTitle as string,
    typeName: raw.MatterTypeName as string,
    statusName: raw.MatterStatusName as string,
    introDate: str(raw.MatterIntroDate),
  };
}

// History rows don't carry their matter id, so the caller supplies it.
export function parseHistory(raw: Raw, matterId: number): HistoryRecord {
  return {
    legistarId: raw.MatterHistoryId as number,
    matterId,
    date: raw.MatterHistoryActionDate as string,
    bodyName: raw.MatterHistoryActionBodyName as string,
    actionName: raw.MatterHistoryActionName as string,
    passed: passedFlag(raw.MatterHistoryPassedFlagName),
    eventId: num(raw.MatterHistoryEventId),
  };
}

export function parseVote(raw: Raw, eventItemId: number): VoteRecord {
  return {
    eventItemId,
    personId: raw.VotePersonId as number,
    personName: raw.VotePersonName as string,
    value: raw.VoteValueName as string,
  };
}
