import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseEvent,
  parseEventItem,
  parseHistory,
  parseMatter,
  parseVote,
} from "@/lib/legistar/parse";

const fx = (name: string) =>
  JSON.parse(readFileSync(`tests/fixtures/legistar/${name}.json`, "utf8"));

describe("parseEvent", () => {
  it("parses the 13559 City Plan Commission meeting", () => {
    const e = parseEvent(fx("event-13559"));
    expect(e.legistarId).toBe(13559);
    expect(e.bodyId).toBe(272);
    expect(e.bodyName).toBe("CITY PLAN COMMISSION");
    expect(e.clipId).toBe(5310);
    expect(e.startsAt).toBe("2026-09-28T13:30:00-05:00");
    expect(e.agendaUrl).toContain("Meeting_Agenda.pdf");
    expect(e.minutesUrl).toContain("Meeting_Minutes.pdf");
    expect(e.insiteUrl).toContain("LEGID=13559");
  });

  it("leaves clipId undefined for null or '0' EventMedia", () => {
    const raw = fx("event-13559");
    expect(parseEvent({ ...raw, EventMedia: null }).clipId).toBeUndefined();
    expect(parseEvent({ ...raw, EventMedia: "0" }).clipId).toBeUndefined();
  });

  it("uses the winter offset in January", () => {
    const raw = { ...fx("event-13559"), EventDate: "2027-01-12T00:00:00", EventTime: "9:00 AM" };
    expect(parseEvent(raw).startsAt).toBe("2027-01-12T09:00:00-06:00");
  });

  it("handles noon, midnight and a missing time", () => {
    const raw = fx("event-13559");
    expect(parseEvent({ ...raw, EventTime: "12:00 PM" }).startsAt).toBe("2026-09-28T12:00:00-05:00");
    expect(parseEvent({ ...raw, EventTime: "12:15 AM" }).startsAt).toBe("2026-09-28T00:15:00-05:00");
    expect(parseEvent({ ...raw, EventTime: null }).startsAt).toBe("2026-09-28T00:00:00-05:00");
  });

  it("drops null URLs", () => {
    const e = parseEvent({ ...fx("event-13559"), EventAgendaFile: null, EventMinutesFile: null });
    expect(e.agendaUrl).toBeUndefined();
    expect(e.minutesUrl).toBeUndefined();
  });
});

describe("parseEventItem", () => {
  const items: Record<string, unknown>[] = fx("eventitems-13559");

  it("parses the Southgate item", () => {
    const raw = items.find((i) => i.EventItemMatterFile === "260532")!;
    const it = parseEventItem(raw);
    expect(it.legistarId).toBe(495638);
    expect(it.eventId).toBe(13559);
    expect(it.matterId).toBe(74559);
    expect(it.fileNumber).toBe("260532");
    expect(it.videoStartSec).toBe(829);
    expect(it.passed).toBe(true);
    expect(it.mover).toBe("Ranell Washington");
    expect(it.seconder).toBe("Jesus Gonzalez");
    expect(it.actionName).toContain("RECOMMENDED FOR");
  });

  it("turns MinutesNote HTML into plain text", () => {
    const base = items[0];
    const note = (n: unknown) => parseEventItem({ ...base, EventItemMinutesNote: n }).minutesNote;
    expect(note("<p>Appearing: Brian Emrich, Allegro Civil Engineers</p>")).toBe("Appearing: Brian Emrich, Allegro Civil Engineers");
    expect(note("<p>A &amp; B</p>\r\n<p>Mr.&nbsp;Salata  &#8211; ok</p>")).toBe("A & B Mr. Salata \u2013 ok");
    expect(note(null)).toBeUndefined();
    expect(note("<p> </p>")).toBeUndefined();
  });

  it("parses an agenda header with no matter", () => {
    const header = parseEventItem(items.find((i) => i.EventItemId === 495633)!);
    expect(header.matterId).toBeUndefined();
    expect(header.fileNumber).toBeUndefined();
    expect(header.passed).toBeUndefined();
    expect(header.videoStartSec).toBeUndefined();
  });

  it("keeps a null sequence as null", () => {
    expect(parseEventItem(items.find((i) => i.EventItemId === 496546)!).sequence).toBeNull();
  });

  it("maps Fail to false", () => {
    const raw = { ...items[0], EventItemPassedFlagName: "Fail" };
    expect(parseEventItem(raw).passed).toBe(false);
  });
});

describe("parseMatter", () => {
  it("parses Bookends / Zenith", () => {
    const m = parseMatter(fx("matter-74560"));
    expect(m).toMatchObject({
      legistarId: 74560,
      fileNumber: "260533",
      typeName: "Ordinance",
      statusName: "In Council-Passage",
      introDate: "2026-07-31T00:00:00",
    });
    expect(m.title).toContain("Zenith");
  });
});

describe("parseHistory", () => {
  const rows: Record<string, unknown>[] = fx("histories-74560");

  it("keeps the eventId for the Plan Commission step", () => {
    const h = parseHistory(rows.find((r) => r.MatterHistoryId === 495640)!, 74560);
    expect(h).toMatchObject({
      legistarId: 495640,
      matterId: 74560,
      bodyName: "CITY PLAN COMMISSION",
      actionName: "APPROVED CONDITIONALLY",
      passed: true,
      eventId: 13559,
      date: "2026-09-28T00:00:00",
    });
  });

  it("leaves eventId and passed undefined when absent", () => {
    const h = parseHistory(rows.find((r) => r.MatterHistoryId === 494015)!, 74560);
    expect(h.eventId).toBeUndefined();
  });
});

describe("parseVote", () => {
  it("parses a council vote", () => {
    const raw = fx("votes-496980")[0];
    expect(parseVote(raw, 496980)).toEqual({
      eventItemId: 496980,
      personId: 3694,
      personName: "ALD. A. PRATT",
      value: "Aye",
    });
  });
});
