import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VoteTable } from "../../app/(site)/meetings/_components/VoteTable";

const votes = [
  { personId: 2, name: "Allyson Nemec", value: "Excused" },
  { personId: 1, name: "Tarik Moody", value: "Aye" },
  { personId: 3, name: "Willie Smith", value: "Aye" },
];

describe("VoteTable", () => {
  it("lists every member's recorded vote", () => {
    const html = renderToStaticMarkup(<VoteTable votes={votes} />);
    for (const v of votes) expect(html).toContain(`>${v.name}<`);
    expect(html).toContain("<caption");
  });

  // Global Constraints: Tarik's votes render exactly like every other member's.
  it("Tarik Moody's row has the same markup as every other member's", () => {
    const html = renderToStaticMarkup(<VoteTable votes={votes} />);
    const rows = [...html.matchAll(/<tr>.*?<\/tr>/g)].map((m) => m[0]).slice(1); // skip the header row
    expect(rows).toHaveLength(3);
    const shape = (row: string) => row.replace(/>[^<]*</g, "><");
    expect(new Set(rows.map(shape)).size).toBe(1);
  });
});
