// Usage: npx tsx scripts/sam-check.ts <fileNumber> [...]   (DEV deployment only; one SAM call per file)
// Finds the exhibit map's "Subject Site" outline by color, asks SAM 3.1 to trace the same area, stores matters.exhibitCheck.
// It records agreement only; it never changes the lot drawn from city property records.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convexRun } from "./convex-run";
import { findSubjectSiteBox, iou, samTrace } from "../lib/geo/subjectSite";

const AGREE_IOU = 0.7;
const UA = "Minutes/0.1 (tarik@radiomilwaukee.org)";

async function main() {
  for (const fileNumber of process.argv.slice(2)) {
    const matter = convexRun<{ attachments?: { name: string; hyperlink: string }[] } | null>("legistar:getMatterByFileNumber", { fileNumber });
    const map = matter?.attachments?.find((a) => a.name.trim().toLowerCase() === "map");
    if (!map) { console.log(`${fileNumber}: no "Map" attachment, skipped`); continue; }

    const dir = mkdtempSync(join(tmpdir(), "sam-check-"));
    const res = await fetch(map.hyperlink, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${fileNumber}: map download HTTP ${res.status}`);
    writeFileSync(join(dir, "map.pdf"), Buffer.from(await res.arrayBuffer()));
    execFileSync("pdftoppm", ["-png", "-r", "110", "-f", "1", "-l", "1", "-singlefile", join(dir, "map.pdf"), join(dir, "page")]);
    const png = readFileSync(join(dir, "page.png"));

    const colorBox = findSubjectSiteBox(png);
    console.log(`${fileNumber}: color box`, colorBox);
    if (!colorBox) { console.log(`${fileNumber}: no subject-site outline found by color; nothing stored`); continue; }
    const sam = await samTrace(png, colorBox);
    console.log(`${fileNumber}: SAM box`, sam?.box ?? null);
    const value = sam ? iou(colorBox, sam.box) : 0;
    const check = { agrees: value >= AGREE_IOU, iou: Math.round(value * 1000) / 1000, checkedAt: Date.now() };
    convexRun("legistar:setExhibitCheck", { fileNumber, ...check });
    console.log(`${fileNumber}: stored exhibitCheck`, check);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
