import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findSubjectSiteBox, iou, parseSamBoxes, samTrace } from "../../lib/geo/subjectSite";

const png = readFileSync("tests/fixtures/exhibits/260532_map-1.png");
const near = (a: number, b: number) => Math.abs(a - b) <= 10;

describe("findSubjectSiteBox", () => {
  it("finds the blue Subject Site outline on the Southgate exhibit, not the yellow boundary", () => {
    const b = findSubjectSiteBox(png)!;
    expect(b).not.toBeNull();
    expect([near(b.x1, 405), near(b.y1, 600), near(b.x2, 590), near(b.y2, 760)]).toEqual([true, true, true, true]);
    expect(near(b.x1, 241) && near(b.y1, 211)).toBe(false);
  });
  it("ignores look-alike blue zoning fills on the Bookends exhibit (eyeballed box 318,305-510,632)", () => {
    const b = findSubjectSiteBox(readFileSync("tests/fixtures/exhibits/260533_map-1.png"))!;
    expect([near(b.x1, 318), near(b.y1, 305), near(b.x2, 510), near(b.y2, 632)]).toEqual([true, true, true, true]);
  });
  it("returns null for a non-PNG buffer", () => {
    expect(findSubjectSiteBox(Buffer.from("nope"))).toBeNull();
  });
});

describe("SAM response parsing", () => {
  const recorded = readFileSync("tests/fixtures/exhibits/sam_response_dashed_line.txt", "utf8");
  it("parses a recorded response into boxes with masks", () => {
    const r = parseSamBoxes(recorded);
    expect(r[0].box).toEqual({ x1: 241, y1: 211, x2: 591, y2: 763 });
    expect(r[0].mask).toMatch(/^x=0;y=0;data=/);
  });
  it("empty text means no match", () => expect(parseSamBoxes("")).toEqual([]));
});

describe("iou", () => {
  it("is 1 for identical boxes and 0 for disjoint", () => {
    const a = { x1: 0, y1: 0, x2: 10, y2: 10 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x1: 20, y1: 20, x2: 30, y2: 30 })).toBe(0);
  });
});

describe("samTrace", () => {
  const body = (text: string) => JSON.stringify({ output: [{ content: [{ type: "output_text", text }] }] });
  it("sends a box prompt with honest UA + bearer and returns SAM's box", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(body("<0f>1<|box;x1=400;y1=598;x2=592;y2=762;w=1210;h=935|><|mask;x=0;y=0;data=abc|>"));
    };
    const r = await samTrace(png, { x1: 405, y1: 600, x2: 590, y2: 760 }, { fetchImpl, apiKey: "k" });
    expect(r?.box).toEqual({ x1: 400, y1: 598, x2: 592, y2: 762 });
    expect(calls[0].url).toBe("https://api.meta.ai/v1/responses");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("Minutes/0.1 (tarik@radiomilwaukee.org)");
    expect(headers.Authorization).toBe("Bearer k");
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.model).toBe("sam-3.1");
    expect(sent.input[0].content[0].text).toBe("<0f>1<|box;x1=405;y1=600;x2=590;y2=760;w=1210;h=935|>");
    expect(sent.input[0].content[1].image_url).toMatch(/^data:image\/png;base64,/);
  });
  it("returns null on empty output and throws on HTTP error", async () => {
    expect(await samTrace(png, { x1: 1, y1: 1, x2: 5, y2: 5 }, { fetchImpl: async () => new Response(body("")), apiKey: "k" })).toBeNull();
    await expect(samTrace(png, { x1: 1, y1: 1, x2: 5, y2: 5 }, { fetchImpl: async () => new Response("bad", { status: 400 }), apiKey: "k" })).rejects.toThrow(/400/);
  });
});
