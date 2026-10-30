import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Parts, SourceNote, Transcript } from "../../app/(site)/meetings/_components/MeetingBits";

const noop = () => {};
const located = { located: "video-index", startMs: 1000, endMs: 9000, parts: [] };
const turn = { turnKey: "0:1", startMs: 2000, text: "We we have a quorum.", display: "Speaker A", asHeard: false };

// Review Focus 4: what a resident sees when the recording or transcript is missing.
describe("meeting states (Review Focus 4)", () => {
  it("a chapter the recording could not place says so", () => {
    expect(renderToStaticMarkup(<Parts chapter={{ ...located, located: "not-located", startMs: null, endMs: null }} watch={noop} />)).toContain(
      "We couldn&#x27;t find this item in the recording.",
    );
  });
  it("captions are labeled as the city's machine captions", () => {
    expect(renderToStaticMarkup(<SourceNote source="captions" />)).toContain("City machine captions");
    expect(renderToStaticMarkup(<Transcript chapter={located} turns={[turn]} source="captions" watch={noop} />)).toContain("City machine captions");
  });
  it("a meeting without a transcript says so", () => {
    expect(renderToStaticMarkup(<SourceNote source="none" />)).toContain("No transcript yet.");
    expect(renderToStaticMarkup(<Transcript chapter={located} turns={[]} source="none" watch={noop} />)).toContain("No transcript yet.");
  });
  it("transcript rows are lightly cleaned (repeated word removed) and labeled as such", () => {
    const html = renderToStaticMarkup(<Transcript chapter={located} turns={[turn]} source="transcript" watch={noop} />);
    expect(html).toContain("Lightly cleaned machine transcript");
    expect(html).toContain("We have a quorum.");
  });
});
