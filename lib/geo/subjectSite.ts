import { inflateSync } from "node:zlib";

// Cross-check only: this never changes the lot we draw (city MPROP + parcel polygon). See docs/decisions/002.
export type Box = { x1: number; y1: number; x2: number; y2: number };
type Rgb = [number, number, number];

const USER_AGENT = "Minutes/0.1 (tarik@radiomilwaukee.org)";
const SAM_URL = "https://api.meta.ai/v1/responses";
const CELL = 12;
const SWATCH_TOLERANCE = 8;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type Image = { w: number; h: number; ch: number; px: Uint8Array };

// Minimal PNG decoder: 8-bit RGB/RGBA, non-interlaced (what pdftoppm -png emits). Anything else -> null.
function decodePng(png: Buffer): Image | null {
  if (png.length < 33 || !png.subarray(0, 8).equals(PNG_SIG)) return null;
  let w = 0, h = 0, ch = 0;
  const idat: Buffer[] = [];
  for (let p = 8; p + 8 <= png.length; ) {
    const len = png.readUInt32BE(p);
    const type = png.toString("latin1", p + 4, p + 8);
    const data = png.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      const [depth, color, , , interlace] = [data[8], data[9], data[10], data[11], data[12]];
      if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) return null;
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); ch = color === 2 ? 3 : 4;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (!w || !h) return null;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? px[(y - 1) * stride + x - ch] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = (raw[src + x] + add) & 255;
    }
  }
  return { w, h, ch, px };
}

const isBlueInk = ([r, g, b]: Rgb) => b > 120 && b - r > 80 && b - g > 40;
const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Bounding box of the "Subject Site" dashed outline on a city exhibit map.
 * ponytail: assumes the exhibit layout (map left, legend panel in the right ~36%, "Subject Site" the first legend swatch
 * near the top). Learns the swatch color from that corner, then boxes matching pixels left of it. A different layout
 * returns null (or a wrong box the SAM/IoU check will flag) rather than guessing.
 */
export function findSubjectSiteBox(png: Buffer): Box | null {
  const img = decodePng(png);
  if (!img) return null;
  const at = (x: number, y: number): Rgb => { const i = (y * img.w + x) * img.ch; return [img.px[i], img.px[i + 1], img.px[i + 2]]; };
  const legendX = Math.floor(img.w * 0.64);
  const counts = new Map<string, number>();
  for (let y = 0; y < img.h * 0.3; y++)
    for (let x = legendX; x < img.w; x++) {
      const c = at(x, y);
      if (isBlueInk(c)) counts.set(c.join(","), (counts.get(c.join(",")) ?? 0) + 1);
    }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const swatch = top[0].split(",").map(Number) as Rgb;
  // Bin matching pixels into CELL-px cells and keep the connected group (8-neighbour) with the most pixels: the dashed
  // outline stays connected across its gaps, while stray look-alike pixels in zoning fills do not.
  const cols = Math.ceil(legendX / CELL);
  const cells = new Map<number, { n: number; x1: number; y1: number; x2: number; y2: number }>();
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < legendX; x++) {
      if (dist(at(x, y), swatch) > SWATCH_TOLERANCE) continue;
      const k = Math.floor(y / CELL) * cols + Math.floor(x / CELL);
      const c = cells.get(k) ?? { n: 0, x1: x, y1: y, x2: x, y2: y };
      cells.set(k, { n: c.n + 1, x1: Math.min(c.x1, x), y1: Math.min(c.y1, y), x2: Math.max(c.x2, x), y2: Math.max(c.y2, y) });
    }
  const seen = new Set<number>();
  let best: { n: number; x1: number; y1: number; x2: number; y2: number } | null = null;
  for (const start of cells.keys()) {
    if (seen.has(start)) continue;
    const group = { n: 0, x1: Infinity, y1: Infinity, x2: -1, y2: -1 };
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const k = stack.pop()!;
      const c = cells.get(k)!;
      group.n += c.n; group.x1 = Math.min(group.x1, c.x1); group.y1 = Math.min(group.y1, c.y1);
      group.x2 = Math.max(group.x2, c.x2); group.y2 = Math.max(group.y2, c.y2);
      for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
        const nk = k + dy * cols + dx;
        const nx = (k % cols) + dx;
        if (nx < 0 || nx >= cols || !cells.has(nk) || seen.has(nk)) continue;
        seen.add(nk); stack.push(nk);
      }
    }
    if (!best || group.n > best.n) best = group;
  }
  return best && best.n >= 50 ? { x1: best.x1, y1: best.y1, x2: best.x2, y2: best.y2 } : null;
}

export function pngSize(png: Buffer): { w: number; h: number } {
  return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) };
}

const BOX_RE = /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=\d+;h=\d+[^|]*\|>(?:<\|mask;([^|]*)\|>)?/g;

/** Parse SAM's token stream into boxes (+ raw mask string when present). Empty text = no match. */
export function parseSamBoxes(text: string): { box: Box; mask?: string }[] {
  return [...text.matchAll(BOX_RE)].map((m) => ({
    box: { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] },
    ...(m[5] ? { mask: m[5] } : {}),
  }));
}

export function iou(a: Box, b: Box): number {
  const iw = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const ih = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = iw * ih;
  const area = (r: Box) => (r.x2 - r.x1) * (r.y2 - r.y1);
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Ask SAM 3.1 to segment the object inside `box`. Returns its box (+mask) or null when SAM finds nothing. */
export async function samTrace(
  png: Buffer,
  box: Box,
  opts: { fetchImpl?: FetchLike; apiKey?: string } = {},
): Promise<{ box: Box; mask?: string } | null> {
  const apiKey = opts.apiKey ?? process.env.META_API_KEY;
  if (!apiKey) throw new Error("META_API_KEY is not set");
  const { w, h } = pngSize(png);
  const prompt = `<0f>1<|box;x1=${box.x1};y1=${box.y1};x2=${box.x2};y2=${box.y2};w=${w};h=${h}|>`;
  const res = await (opts.fetchImpl ?? fetch)(SAM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({
      model: "sam-3.1",
      input: [{ role: "user", content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: `data:image/png;base64,${png.toString("base64")}` },
      ] }],
    }),
  });
  if (!res.ok) throw new Error(`SAM request failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { output?: { content?: { type: string; text?: string }[] }[] };
  const text = (json.output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
  return parseSamBoxes(text)[0] ?? null;
}
