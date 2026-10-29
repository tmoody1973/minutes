import { describe, expect, it } from "vitest";
import { granicusLink, labelChapters, selfIntroName, spellingHints } from "@/lib/media/review";

describe("granicusLink", () => {
  it("links to the second", () => {
    expect(granicusLink(8765, 829999)).toBe("https://milwaukee.granicus.com/MediaPlayer.php?clip_id=8765&starttime=829");
  });
});

describe("labelChapters", () => {
  const chapters = [
    { eventItemId: 1, startMs: 0, endMs: 1000, located: "video-index" as const, fileNumber: "A", title: "First" },
    { eventItemId: 2, startMs: 1000, endMs: 2000, located: "cue" as const, fileNumber: "B", title: "Second" },
    { eventItemId: 3, startMs: null, endMs: null, located: "not-located" as const, fileNumber: "C", title: "Lost" },
  ];
  const turns = [
    { label: "c0:A", startMs: 10 }, { label: "c0:A", startMs: 20 }, { label: "c0:B", startMs: 30 },
    { label: "c0:A", startMs: 1500 }, { label: "c0:A", startMs: 5000 },
  ];
  it("counts a label's turns per located chapter, in chapter order", () => {
    expect(labelChapters(turns, chapters, "c0:A")).toEqual([
      { eventItemId: 1, fileNumber: "A", title: "First", turnCount: 2 },
      { eventItemId: 2, fileNumber: "B", title: "Second", turnCount: 1 },
    ]);
    expect(labelChapters(turns, chapters, "c0:B")).toHaveLength(1);
  });
});

describe("spellingHints", () => {
  it("finds the minutes spelling of a surname", () => {
    expect(spellingHints("Brian Emmerich", "Appearing: Brian Emrich, Allegro Civil Engineers Ned Brickman, landowner representative")).toEqual(["Brian Emrich"]);
  });
  it("allows a surname-only hint after an honorific", () => {
    expect(spellingHints("Kristen Connolly", "Ms. Connelly presented.")).toEqual(["Connelly"]);
  });
  it("matches a different first name with the same initial", () => {
    expect(spellingHints("Dave Salata", "Public testimony in support: David Celata, Milwaukee Greater Foundation Mr. Salata testified")).toEqual(["David Celata", "Salata"]);
  });
  it("returns nothing without a near match, and never the heard name", () => {
    expect(spellingHints("Jane Doe", "Appearing: Brian Emrich, Allegro Civil Engineers")).toEqual([]);
    expect(spellingHints("Brian Emrich", "Appearing: Brian Emrich, Allegro")).toEqual([]);
  });
});

describe("selfIntroName", () => {
  it("reads a spoken introduction", () => {
    expect(selfIntroName("Absolutely my name is Brian Emmerich I'm with Allegro civil engineers")).toBe("Brian Emmerich");
    expect(selfIntroName("this is the main entry again Kilbourn and Van Buren")).toBeUndefined();
  });
});
