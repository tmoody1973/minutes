import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { compareToColorBox, findSubjectSite, findSubjectSiteBox, iou, parseSamBoxes, samTrace } from "../../lib/geo/subjectSite";

const png = readFileSync("tests/fixtures/exhibits/260532_map-1.png");
// Tiny PNG writer for synthetic cases (CRCs are zeros; our decoder does not check them).
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
};
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function makePng(w: number, h: number, o: { depth?: number; color?: number; interlace?: number; paint?: (x: number, y: number) => number[]; idatBytes?: Buffer } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = o.depth ?? 8; ihdr[9] = o.color ?? 2; ihdr[12] = o.interlace ?? 0;
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = [0];
    for (let x = 0; x < w; x++) row.push(...(o.paint?.(x, y) ?? [255, 255, 255]));
    rows.push(Buffer.from(row));
  }
  const idat = o.idatBytes ?? deflateSync(Buffer.concat(rows));
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}
const BLUE = [0, 64, 160];
// 400x300 page: legend swatch top-right (x>=256), plus one filled blue block in the map area.
const withBlock = (x1: number, y1: number, x2: number, y2: number) =>
  makePng(400, 300, { paint: (x, y) => ((x >= 300 && x < 320 && y >= 20 && y < 30) || (x >= x1 && x <= x2 && y >= y1 && y <= y2) ? BLUE : [255, 255, 255]) });

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

describe("findSubjectSiteBox sanity bounds", () => {
  it("accepts a plausible block", () => expect(findSubjectSiteBox(withBlock(50, 50, 109, 109))).toEqual({ x1: 50, y1: 50, x2: 109, y2: 109 }));
  it("rejects a bad aspect ratio", () => expect(findSubjectSiteBox(withBlock(20, 100, 219, 103))).toBeNull());
  it("rejects a box under 0.5% of the image", () => expect(findSubjectSiteBox(withBlock(50, 50, 69, 69))).toBeNull());
  it("rejects a box over 40% of the image", () => expect(findSubjectSiteBox(withBlock(3, 3, 253, 203))).toBeNull());
  it("rejects a box touching the image edge", () => expect(findSubjectSiteBox(withBlock(0, 50, 59, 109))).toBeNull());
});

describe("findSubjectSite outline point", () => {
  it("returns a pixel ON the hollow outline (not the empty center), nearest the top-edge midpoint", () => {
    const ring = makePng(400, 300, { paint: (x, y) => {
      const swatch = x >= 300 && x < 320 && y >= 20 && y < 30;
      const inBox = x >= 50 && x <= 109 && y >= 50 && y <= 109;
      const onRing = inBox && (x <= 52 || x >= 107 || y <= 52 || y >= 107);
      return swatch || onRing ? BLUE : [255, 255, 255];
    } });
    const r = findSubjectSite(ring)!;
    expect(r.box).toEqual({ x1: 50, y1: 50, x2: 109, y2: 109 });
    expect(r.point.y).toBeLessThanOrEqual(52);
    expect(Math.abs(r.point.x - 80)).toBeLessThanOrEqual(1);
  });
  it("on the Southgate fixture the point lies inside the color box near its top edge", () => {
    const r = findSubjectSite(png)!;
    expect(r.point.x).toBeGreaterThanOrEqual(r.box.x1);
    expect(r.point.x).toBeLessThanOrEqual(r.box.x2);
    expect(r.point.y - r.box.y1).toBeLessThan(15);
  });
});

describe("PNG decoder guards", () => {
  const ok = (o: Parameters<typeof makePng>[2]) => expect(findSubjectSiteBox(makePng(8, 8, o))).toBeNull();
  it("palette PNG -> null", () => ok({ color: 3 }));
  it("16-bit PNG -> null", () => ok({ depth: 16 }));
  it("interlaced PNG -> null", () => ok({ interlace: 1 }));
  it("truncated IDAT -> null", () => ok({ idatBytes: deflateSync(Buffer.alloc(10)) }));
});

describe("compareToColorBox", () => {
  const cb = { x1: 100, y1: 100, x2: 200, y2: 200 };
  it("IoU >= 0.7 is noConflict, below is not (threshold)", () => {
    expect(compareToColorBox(cb, { x1: 100, y1: 100, x2: 200, y2: 170 }, 5).noConflict).toBe(true); // 0.70
    expect(compareToColorBox(cb, { x1: 100, y1: 100, x2: 200, y2: 169 }, 5).noConflict).toBe(false); // 0.69
  });
  it("no color box -> noConflict false, reason no-color-box", () =>
    expect(compareToColorBox(null, null, 5)).toEqual({ noConflict: false, iou: 0, method: "outline-point", colorBox: null, samBox: null, reason: "no-color-box", checkedAt: 5 }));
  it("no SAM match -> noConflict false, reason sam-no-match", () =>
    expect(compareToColorBox(cb, null, 5)).toEqual({ noConflict: false, iou: 0, method: "outline-point", colorBox: cb, samBox: null, reason: "sam-no-match", checkedAt: 5 }));
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
  it("sends a point prompt with honest UA + bearer and returns SAM's box", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(body("<0f>1<|box;x1=400;y1=598;x2=592;y2=762;w=1210;h=935|><|mask;x=0;y=0;data=abc|>"));
    };
    const r = await samTrace(png, { x: 497, y: 680 }, { fetchImpl, apiKey: "k" });
    expect(r?.box).toEqual({ x1: 400, y1: 598, x2: 592, y2: 762 });
    expect(calls[0].url).toBe("https://api.meta.ai/v1/responses");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("Minutes/0.1 (tarik@radiomilwaukee.org)");
    expect(headers.Authorization).toBe("Bearer k");
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.model).toBe("sam-3.1");
    expect(sent.input[0].content[0].text).toBe("<0f>1<|point;x=497;y=680;w=1210;h=935|>");
    expect(sent.input[0].content[1].image_url).toMatch(/^data:image\/png;base64,/);
  });
  it("returns null on empty output and throws on HTTP error", async () => {
    expect(await samTrace(png, { x: 1, y: 1 }, { fetchImpl: async () => new Response(body("")), apiKey: "k" })).toBeNull();
    await expect(samTrace(png, { x: 1, y: 1 }, { fetchImpl: async () => new Response("bad", { status: 400 }), apiKey: "k" })).rejects.toThrow(/400/);
  });
});
