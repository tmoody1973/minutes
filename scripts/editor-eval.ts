// Usage: npx tsx scripts/editor-eval.ts
// Trap test for the Editor on real Bookends records (DEV): sentences that are wrong in a known way must be rejected,
// correct ones must pass. Calls Muse Spark (META_API_KEY from .env.local). Writes nothing.
import { editorCheck } from "../lib/editor/check";
import { convexRun } from "./convex-run";

process.loadEnvFile(".env.local");

const ZND = "history:497562"; // Oct 27, 2026: ZND committee recommended passage, 5-0-0
const CPC = "history:495640"; // Sep 28, 2026: CPC approved conditionally, 5-0-2 excused
const NEXT = "item:498115"; // Common Council, Wed Nov 4, 9:00 AM
const CASES: { text: string; keys: string[]; expect: "pass" | "reject"; trap: string }[] = [
  { text: "The Zoning, Neighborhoods & Development committee recommended passage on Oct 27, 2026, 7 aye, 0 no.", keys: [ZND], expect: "reject", trap: "wrong vote count" },
  { text: "The Zoning, Neighborhoods & Development committee recommended passage on Oct 28, 2026.", keys: [ZND], expect: "reject", trap: "wrong date" },
  { text: "The committee recommended passage because the building adds housing downtown.", keys: [ZND], expect: "reject", trap: "invented reason" },
  { text: "The Common Council will approve it on Nov 4.", keys: [NEXT], expect: "reject", trap: "prediction" },
  { text: "The City Plan Commission approved the much-needed building on Sep 28, 2026.", keys: [CPC], expect: "reject", trap: "evaluative word" },
  { text: "The proposal drew strong neighborhood support at the City Plan Commission.", keys: [CPC], expect: "reject", trap: "claim not in records" },
  { text: "The City Plan Commission approved it conditionally on Sep 28, 2026, 5 aye, 0 no, 2 excused.", keys: [CPC], expect: "pass", trap: "control" },
  { text: "The Common Council has it on the agenda for Wed, Nov 4, 9:00 AM.", keys: [NEXT], expect: "pass", trap: "control" },
];

async function main() {
  const { sources } = convexRun<{ sources: { key: string; text: string }[] }>("editor:cardSources", { kind: "file", key: "260533" });
  const texts = new Map(sources.map((s) => [s.key, s.text]));
  let right = 0;
  for (const c of CASES) {
    const v = await editorCheck({ text: c.text, sourceKeys: c.keys }, texts);
    const got = v.ok ? "pass" : "reject";
    if (got === c.expect) right++;
    console.log(`${got === c.expect ? "OK  " : "MISS"} ${c.trap}: ${got}${v.ok ? "" : ` (${v.reason}: ${v.detail})`}\n     ${c.text}`);
  }
  console.log(`${right}/${CASES.length} as expected`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
