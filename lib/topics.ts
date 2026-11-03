// Topics by rule, no model: a file's topic is the committee or commission it went through (UX brief, 2026-11-02).
// Legistar's own subject tags are applied only at enactment, so they can't sort files that are still pending.
export const TOPICS = {
  budget: "Budget and city money",
  safety: "Public safety and health",
  licenses: "Licenses",
  streets: "Streets and public works",
  development: "Development and housing",
  economy: "Economic development",
  laws: "City laws",
  council: "Council business",
} as const;

export type Topic = keyof typeof TOPICS;

const BY_BODY = new Map<string, Topic>([
  ["FINANCE & PERSONNEL COMMITTEE", "budget"],
  ["PUBLIC SAFETY AND HEALTH COMMITTEE", "safety"],
  ["PUBLIC SAFETY COMMITTEE", "safety"],
  ["FIRE AND POLICE COMMISSION", "safety"],
  ["LICENSES COMMITTEE", "licenses"],
  ["UTILITIES AND LICENSES COMMITTEE", "licenses"],
  ["PUBLIC WORKS COMMITTEE", "streets"],
  ["ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE", "development"],
  ["CITY PLAN COMMISSION", "development"],
  ["HISTORIC PRESERVATION COMMISSION", "development"],
  ["COMMUNITY & ECONOMIC DEVELOPMENT COMMITTEE", "economy"],
  ["JUDICIARY & LEGISLATION COMMITTEE", "laws"],
  ["STEERING & RULES COMMITTEE", "council"],
]);

/** The topic a body decides, or undefined for the Council, the Mayor and bodies Minutes doesn't sort. */
export const topicOfBody = (bodyName: string): Topic | undefined => BY_BODY.get(bodyName.trim().toUpperCase());

/** First committee with a topic, in history order; a Council-only file is Council business. */
export function topicOfFile(historyBodyNames: string[]): Topic {
  for (const b of historyBodyNames) {
    const t = topicOfBody(b);
    if (t) return t;
  }
  return "council";
}
