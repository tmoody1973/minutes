// Usage: npx tsx scripts/sam-check.ts <fileNumber> [...]   (DEV deployment only; one SAM call per file; needs pdftoppm + META_API_KEY)
// Finds the exhibit map's "Subject Site" outline by color, prompts SAM 3.1 with only that box's center point, and stores
// matters.exhibitCheck (noConflict = IoU >= 0.7). It records the result only; it never changes the lot drawn from city records.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convexRun } from "./convex-run";
import { center, compareToColorBox, findSubjectSiteBox, samTrace } from "../lib/geo/subjectSite";

const UA = "Minutes/0.1 (tarik@radiomilwaukee.org)";

function renderMapPng(url: string, fileNumber: string): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), "sam-check-"));
  return fetch(url, { headers: { "User-Agent": UA } })
    .then(async (res) => {
      if (!res.ok) throw new Error(`${fileNumber}: map download HTTP ${res.status}`);
      writeFileSync(join(dir, "map.pdf"), Buffer.from(await res.arrayBuffer()));
      execFileSync("pdftoppm", ["-png", "-r", "110", "-f", "1", "-l", "1", "-singlefile", join(dir, "map.pdf"), join(dir, "page")]);
      return readFileSync(join(dir, "page.png"));
    })
    .finally(() => rmSync(dir, { recursive: true, force: true }));
}

async function main() {
  for (const fileNumber of process.argv.slice(2)) {
    const matter = convexRun<{ attachments?: { name: string; hyperlink: string }[] } | null>("legistar:getMatterByFileNumber", { fileNumber });
    const map = matter?.attachments?.find((a) => a.name.trim().toLowerCase() === "map");
    if (!map) { console.log(`${fileNumber}: no "Map" attachment, skipped`); continue; }

    const png = await renderMapPng(map.hyperlink, fileNumber);
    const colorBox = findSubjectSiteBox(png);
    const sam = colorBox ? await samTrace(png, center(colorBox)) : null;
    const record = compareToColorBox(colorBox, sam?.box ?? null, Date.now());
    convexRun("legistar:setExhibitCheck", { fileNumber, ...record });
    console.log(`${fileNumber}: colorBox`, colorBox, "samBox", sam?.box ?? null, "iou", record.iou, "noConflict", record.noConflict, record.reason ?? "");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
