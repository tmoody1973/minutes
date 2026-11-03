import { describe, expect, it } from "vitest";
import { agendaRows, chapterResult, titleKind, chapterTitle, clock, meetingSummary, PART_LABELS, quoteCitation, testimonySpeakers, voteRows } from "../../../lib/ui/meeting";

describe("clock", () => {
  it("h:mm:ss over an hour, m:ss under", () => {
    expect(clock(2051000)).toBe("34:11");
    expect(clock(5832000)).toBe("1:37:12");
    expect(clock(0)).toBe("0:00");
  });
});

describe("chapterTitle", () => {
  it("addresses when the title names them", () =>
    expect(chapterTitle("A substitute ordinance relating to the change in zoning from General Planned Development known as Bookends to a Detailed Planned Development known as Zenith to allow the construction of a multi-family residential building at 711 East Kilbourn Avenue and 822 North Van Buren Street, in the 4th Aldermanic District.", "260533")).toBe(
      "711 E. Kilbourn Ave. and 822 N. Van Buren St.",
    ));
  it("otherwise the title's subject, without the legal opening", () => {
    expect(chapterTitle("A substitute ordinance relating to zoning regulations for family day care homes.", "260642")).toBe("Zoning regulations for family day care homes");
    expect(chapterTitle("Resolution approving the 2027 City Plan Commission meeting dates.", "260723")).toBe("Resolution approving the 2027 City Plan Commission meeting dates");
    expect(chapterTitle("Review and approval of the previous meeting minutes from August 17, 2026.")).toBe("Review and approval of the previous meeting minutes from August 17, 2026");
  });
});

describe("chapterResult", () => {
  it("action and tally from the record", () =>
    expect(chapterResult({ actionName: "RECOMMENDED FOR  PASSAGE AND ASSIGNED", tally: { aye: 5, no: 0, excused: 2, other: 0 } })).toBe(
      "Recommended for passage and assigned, Vote 5–0, 2 excused",
    ));
  it("nothing when the record has no action", () => expect(chapterResult({})).toBeNull());
});

describe("titleKind", () => {
  it("names the kind of document from the title's opening words, so same-subject files can be told apart", () => {
    expect(titleKind("A charter ordinance relating to implementation of various provisions of the 2027 budget.")).toBe("Charter ordinance");
    expect(titleKind("A substitute ordinance relating to the change in zoning.")).toBe("Substitute ordinance");
    expect(titleKind("Resolution relating to implementation of various provisions.")).toBe("Resolution");
    expect(titleKind("Communication from the Mayor relating to the proposed 2027 budget.")).toBe("Communication");
    expect(titleKind("Appointment of Jane Doe to the Board.")).toBeNull();
  });
});

describe("agendaRows", () => {
  const t = (aye: number) => ({ aye, no: 0, excused: 0, other: 0 });
  const it_ = (legistarId: number, sequence: number | null, extra: object = {}) => ({ legistarId, sequence, title: "Communication from the Mayor relating to the proposed 2027 budget.", ...extra });
  it("agenda items with a file, in agenda order, with the minutes' actions folded in and a vote only when all agree", () => {
    const rows = agendaRows([
      it_(3, 2, { fileNumber: "260654", actionName: "REFERRED  WITHOUT RECOMMENDATION", tally: t(5), videoStartSec: 900 }),
      it_(1, 1, { fileNumber: "260001", actionName: "AMENDED", tally: t(5), videoStartSec: 83 }),
      it_(10, null, { fileNumber: "260001", actionName: "AMENDED", tally: t(4), videoStartSec: 40 }),
      it_(11, null, { fileNumber: "260001", actionName: "AMENDED (WITHDRAWN)" }),
      it_(12, 5, { title: "This meeting will be webcast live." }), // no file: a notice, not an item
      it_(13, null, { title: "Meeting convened at 9:38 a.m.", videoStartSec: 3 }),
      it_(14, 6, { fileNumber: "260999", removedAt: 1 }),
    ]);
    expect(rows.map((r) => r.fileNumber)).toEqual(["260001", "260654"]);
    expect(rows[0]).toMatchObject({ eventItemId: 1, actions: ["AMENDED", "AMENDED", "AMENDED (WITHDRAWN)"], startSec: 40 });
    expect(rows[0].tally).toBeUndefined();
    expect(rows[1]).toMatchObject({ actions: ["REFERRED  WITHOUT RECOMMENDATION"], tally: t(5), startSec: 900 });
  });
  it("carries the minutes' own words: the clerk's note, and who moved it when the item had one action", () => {
    const [many, one] = agendaRows([
      it_(1, 1, { fileNumber: "260001", actionName: "AMENDED", mover: "ALD. MOORE", minutesNote: "Appearing: Sarah Osborn, Budget Office" }),
      it_(2, null, { fileNumber: "260001", actionName: "AMENDED", mover: "ALD. PEREZ" }),
      it_(3, 2, { fileNumber: "260654", actionName: "PLACED ON FILE", mover: "ALD. MOORE", seconder: "ALD. PEREZ" }),
    ]);
    expect(many).toMatchObject({ note: "Appearing: Sarah Osborn, Budget Office" });
    expect(many.mover).toBeUndefined(); // two motions, two movers: no single "moved by"
    expect(one).toMatchObject({ mover: "Ald. Moore", seconder: "Ald. Perez" });
  });
});

describe("meetingSummary", () => {
  it("length, decisions and named parts count only what the records hold", () =>
    expect(
      meetingSummary({
        turns: [{ endMs: 12_549_860 }],
        chapters: [{ endMs: 12_549_860, item: { actionName: "APPROVED" } }, { endMs: null, item: {} }, { endMs: 200, item: null }],
      }),
    ).toBe("3 hr 29 min of video · 1 decision"));
  it("a meeting without chapters counts the agenda items acted on", () =>
    expect(meetingSummary({ turns: [], chapters: [], agenda: [{ actions: ["AMENDED"] }, { actions: [] }, { actions: ["PLACED ON FILE"] }] })).toBe("2 decisions"));
});

it("part labels cover every stored kind", () =>
  expect(Object.keys(PART_LABELS).sort()).toEqual(["applicant", "discussion", "presentation", "testimony", "vote"]));

describe("testimonySpeakers", () => {
  const t = (display: string, startMs: number, text: string, asHeard = false) => ({ turnKey: `${display}${startMs}`, display, asHeard, startMs, text });
  const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
  const parts = [{ kind: "testimony", startMs: 1000, endMs: 9000 }, { kind: "discussion", startMs: 9000, endMs: 12000 }];

  it("speaking order; short interjections dropped; position only from the speaker's own words", () => {
    const turns = [
      t("Speaker AQ", 1000, "I'm totally against it. " + words(40)),
      t("Speaker AP", 1500, "You need to introduce yourself for the record."),
      t("Curtis Oquist", 2000, "My name is Curtis Oquist. " + words(40), true),
      t("Curtis Oquist", 2500, "I live two blocks away."),
      t("Speaker AQ", 3000, words(5)),
      t("Speaker AM", 9500, "I oppose this project. " + words(40)), // discussion, not testimony
    ];
    const r = testimonySpeakers(turns, parts);
    expect(r.map((s) => s.display)).toEqual(["Speaker AQ", "Curtis Oquist"]);
    expect(r[0]).toMatchObject({ position: { position: "against", quote: "I'm totally against it." }, startMs: 1000, positionTurn: { startMs: 1000 } });
    expect(r[0].positionTurn!.text).toMatch(/^I'm totally against it\. word/);
    expect(r[1]).toMatchObject({ position: null, positionTurn: null, asHeard: true, startMs: 2000 });
  });
  it("someone who also speaks in the chapter's other parts is not listed (commissioners asking questions)", () => {
    const turns = [
      t("Speaker AM", 1000, "Can we ask you a question about the parking? " + words(40)),
      t("Speaker AM", 9500, "I move approval."),
      t("David Guzman", 2000, words(60), true),
    ];
    expect(testimonySpeakers(turns, parts).map((s) => s.display)).toEqual(["David Guzman"]);
  });
  it("a speaker whose turns state both positions is shown as not stated (decision 005)", () => {
    const turns = [
      t("Speaker AQ", 1000, "I support this project. " + words(30)),
      t("Speaker AQ", 2000, "But I oppose this project. " + words(30)),
    ];
    expect(testimonySpeakers(turns, parts)[0]).toMatchObject({ position: null, positionTurn: null });
  });
  it("no testimony part, no list", () => expect(testimonySpeakers([t("A", 1000, words(50))], [{ kind: "discussion", startMs: 0, endMs: 9000 }])).toEqual([]));
});

describe("quoteCitation", () => {
  const base = { quote: "I support this project.", bodyName: "CITY PLAN COMMISSION", startsAt: "2026-09-28T17:30:00-05:00", startMs: 5832000, url: "https://minutes-rust.vercel.app/meetings/13559?item=495640" };
  it("words, speaker, meeting, video time, link", () =>
    expect(quoteCitation({ ...base, speaker: "Jane Doe" })).toBe(
      "“I support this project.” — Jane Doe, City Plan Commission meeting, Sep 28, 2026, at 1:37:12. https://minutes-rust.vercel.app/meetings/13559?item=495640",
    ));
  it("an unnamed speaker keeps their label", () => expect(quoteCitation({ ...base, speaker: "Speaker B" })).toContain("” — Speaker B, City Plan"));
});

describe("voteRows", () => {
  const chapters = [
    { item: { title: "A substitute ordinance, at 711 East Kilbourn Avenue.", fileNumber: "250123", actionName: "APPROVED", tally: { aye: 2, no: 0, excused: 0, other: 0 } }, votes: [{ name: "Allyson Nemec", value: "Aye" }, { name: "Tarik Moody", value: "Aye" }] },
    { item: null, votes: [] },
    { item: { title: "Communication." }, votes: [{ name: "Willie Smith", value: "Excused" }] },
  ];
  const rows = voteRows("2026-09-28T17:30:00-05:00", "CITY PLAN COMMISSION", chapters);
  it("a header, then one row per member vote", () => {
    expect(rows[0]).toEqual(["meeting_date", "body", "chapter", "file_number", "item_title", "result", "member", "vote"]);
    expect(rows.slice(1)).toEqual([
      ["2026-09-28", "City Plan Commission", "1", "250123", chapters[0].item!.title, "Approved, Vote 2–0", "Allyson Nemec", "Aye"],
      ["2026-09-28", "City Plan Commission", "1", "250123", chapters[0].item!.title, "Approved, Vote 2–0", "Tarik Moody", "Aye"],
      ["2026-09-28", "City Plan Commission", "3", "", "Communication.", "", "Willie Smith", "Excused"],
    ]);
  });
});
