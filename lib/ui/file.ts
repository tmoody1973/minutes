// Display helpers for the project page (mockup MinPhoneTracker). Pure: safe in client and server code.
import type { Tally } from "../types";

const sentence = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// The timeline's own markers (lib/timeline/build.ts) read as plain words; Legistar actions are kept, only re-cased.
const MARKERS: Record<string, string> = { SCHEDULED: "Scheduled", "ON AGENDA": "On the agenda" };
export const actionText = (actions: string[]) => actions.map((a) => MARKERS[a] ?? sentence(a)).join("; ");

export function tallyText(t: Tally): string {
  const extra = [t.excused && `${t.excused} excused`, t.other && `${t.other} other`].filter(Boolean);
  return [`Vote ${t.aye}–${t.no}`, ...extra].join(", ");
}

// "2026-09-28" -> "Sep 28, 2026"; with the meeting's start time -> "Wed, Nov 4, 9:00 AM" (Milwaukee time).
export function stepDate(date: string, startsAt?: string): string {
  if (startsAt) {
    return new Date(startsAt).toLocaleString("en-US", {
      timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  }
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

// The title's own purpose clause, quoted: "...to allow the construction of X at 711 East..." -> "To allow the construction of X."
export function purposeLine(title: string): string | null {
  const m = /\bto allow (.+?)(?=,? at \d|,? on the |,? in the \d|\.?$)/i.exec(title);
  return m ? `To allow ${m[1].trim()}.` : null;
}

type Ring = number[][];
type Outline = { type?: string; coordinates?: unknown } | null | undefined;

const ringsOf = (g: Outline): Ring[] => {
  if (!g || !Array.isArray(g.coordinates)) return [];
  if (g.type === "Polygon") return [(g.coordinates as Ring[])[0]].filter(Boolean);
  if (g.type === "MultiPolygon") return (g.coordinates as Ring[][]).map((p) => p[0]).filter(Boolean);
  return [];
};

/**
 * Lot outlines (GeoJSON, lng/lat) as SVG paths fitted into width x height with padding, north up. Longitude is
 * scaled by cos(latitude) so a lot keeps its shape. ponytail: flat projection, fine at block scale; use a real map
 * library if outlines ever span the city.
 */
export function outlineSvg(outlines: Outline[], width: number, height: number, pad: number): { paths: string[] } | null {
  const rings = outlines.flatMap(ringsOf).filter((r) => r.length >= 3);
  if (!rings.length) return null;
  const pts = rings.flat();
  const lats = pts.map((p) => p[1]);
  const kx = Math.cos(((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180));
  const xs = pts.map((p) => p[0] * kx);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...lats), Math.max(...lats)];
  const scale = Math.min((width - 2 * pad) / (maxX - minX || 1), (height - 2 * pad) / (maxY - minY || 1));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  const at = (p: number[]) => `${(offX + (p[0] * kx - minX) * scale).toFixed(1)} ${(offY + (maxY - p[1]) * scale).toFixed(1)}`;
  return { paths: rings.map((r) => `M${r.map(at).join("L")}Z`) };
}

export interface Attachment {
  name: string;
  hyperlink: string;
}

// Source chips (mockup): the staff report and the latest Exhibit A ("as of" dates sort as text within a year).
export function sourceDocs(attachments: Attachment[]): { label: string; hyperlink: string }[] {
  const last = (re: RegExp) => attachments.filter((a) => re.test(a.name)).sort((a, b) => a.name.localeCompare(b.name)).at(-1);
  const staff = last(/staff report/i);
  const exhibit = last(/^exhibit a\b/i);
  return [staff && { label: "Staff report", hyperlink: staff.hyperlink }, exhibit && { label: "Exhibit A", hyperlink: exhibit.hyperlink }].filter(
    (d): d is { label: string; hyperlink: string } => !!d,
  );
}

// The city's own page on taking part, per body (timeline labels). Verified to load 2026-10-29; shown only once
// Tarik confirms each link (plan Task 4.3), like the glossary's plain lines.
export const COMMENT_PAGES: Record<string, { url: string }> = {
  "City Plan Commission": { url: "https://city.milwaukee.gov/DCD/Planning/CPC" },
  "Zoning, Neighborhoods & Development": { url: "https://city.milwaukee.gov/commoncouncil/committees/zoning-neighborhoods--developm" },
  "Common Council": { url: "https://city.milwaukee.gov/commoncouncil" },
};
// Tarik, 2026-10-29: CPC confirmed. ZND's page only names its staff assistant and the Council page has no comment
// instructions, so both stay hidden until a better official page is found.
export const CONFIRMED_COMMENT_PAGES: Readonly<Record<string, boolean>> = { "City Plan Commission": true };

export const commentPage = (body: string, confirmed: Readonly<Record<string, boolean>> = CONFIRMED_COMMENT_PAGES) =>
  confirmed[body] && COMMENT_PAGES[body] ? COMMENT_PAGES[body] : null;

const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Add-to-calendar file for the next hearing. No end time or location: the records give neither reliably.
export function hearingIcs(h: { fileNumber: string; heading: string; body: string; startsAt: string; eventId: number; pageUrl: string }): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Minutes//Milwaukee City Hall//EN",
    "BEGIN:VEVENT",
    `UID:minutes-${h.eventId}-${h.fileNumber}@minutes`,
    `DTSTAMP:${icsTime(h.startsAt)}`,
    `DTSTART:${icsTime(h.startsAt)}`,
    `SUMMARY:${icsText(`${h.body}: file ${h.fileNumber}, ${h.heading}`)}`,
    `DESCRIPTION:${icsText(`Public record and how to take part: ${h.pageUrl}`)}`,
    `URL:${h.pageUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
