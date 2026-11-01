// Words that characterize an item instead of reporting it (brief §3: records, not opinions). A sentence with any of
// them is rejected before the model sees it. Kept short on purpose: factual uses ("goods", "for and against") must pass.
export const EVALUATIVE = [
  "good", "bad", "great", "welcome", "shame", "unfortunately", "unfortunate", "controversial", "should", "deserves",
  "finally", "improvement", "concerning", "beloved", "excellent", "terrible", "best", "worst", "exciting", "vibrant",
  "much-needed", "fortunately", "sadly", "disappointing", "impressive", "beautiful", "ugly", "eyesore", "problematic",
  "troubling", "hopefully",
] as const;

const RE = new RegExp(`(?<![\\w-])(${EVALUATIVE.map((w) => w.replace("-", "\\-")).join("|")})(?![\\w-])`, "i");

// Official names and terms that contain a listed word: removed before matching, so "Business Improvement District #11"
// or "public improvement work" is not read as a judgment. Add here only names that appear in city records.
const NAMES = /\b(?:business|neighborhood) improvement districts?\b|\bpublic improvements?\b|\bgood hope\b|\bgreat lakes\b/gi;

/** The first evaluative word in the text (lowercased), or null. */
export function evaluativeWord(text: string): string | null {
  return RE.exec(text.replace(NAMES, ""))?.[1].toLowerCase() ?? null;
}
