import { describe, expect, it } from "vitest";
import { toCsv } from "../../../lib/ui/csv";

describe("toCsv", () => {
  it("plain fields are left alone, rows end in CRLF", () => expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d\r\n"));
  it("quotes fields with commas", () =>
    expect(toCsv([["Zoning, Neighborhoods & Development", "x"]])).toBe('"Zoning, Neighborhoods & Development",x\r\n'));
  it("doubles inner quotes", () => expect(toCsv([['known as "Zenith"']])).toBe('"known as ""Zenith"""\r\n'));
  it("quotes fields with line breaks", () => expect(toCsv([["line one\nline two", "a\r\nb"]])).toBe('"line one\nline two","a\r\nb"\r\n'));
  it("keeps empty fields in place", () => expect(toCsv([["", "b", ""]])).toBe(",b,\r\n"));
});
