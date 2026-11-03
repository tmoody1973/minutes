// What Legistar's action words mean, for a resident reading an Ask answer. Milwaukee publishes no definitions page
// for these, so each `plain` line is Minutes' own description of the procedure, never a judgment of it, and shows
// only after the builder approves it (`approved: true`), as with the zoning glossary (decision 007). Pure.
// All nine approved by Tarik, 2026-11-03.

export interface ActionTerm {
  term: string;
  /** Every way the term shows up in an answer, including Ask's own everyday wording ("sent on without a recommendation"). */
  spellings: RegExp;
  plain: string;
  approved: boolean;
}

export const ACTION_TERMS: readonly ActionTerm[] = [
  {
    term: "Held to call of the chair",
    spellings: /held to (the )?call of the chair|held in committee/i,
    plain: "The committee set the file aside without deciding it. It stays in committee and comes back only if the committee chair puts it on a later agenda.",
    approved: true,
  },
  {
    term: "Placed on file",
    spellings: /placed on file|placing on file/i,
    plain: "The body received the item for its records and took no further action on it.",
    approved: true,
  },
  {
    term: "Referred without recommendation",
    spellings: /referred without (a )?recommendation|sent on without a recommendation/i,
    plain: "The committee sent the file on to the next body without advising for or against it.",
    approved: true,
  },
  {
    term: "Recommended for passage, adoption or approval",
    spellings: /recommended (for )?(passage|adoption|approval)|recommended approval/i,
    plain: "The committee advised the next body, usually the full Common Council, to approve the file. A committee recommends; the Council makes the decision.",
    approved: true,
  },
  {
    term: "Passed, adopted or approved",
    spellings: /\b(was|were) (passed|adopted|approved)\b/i,
    plain: "The body voted in favor of the file. Ordinances pass, resolutions are adopted and motions are approved.",
    approved: true,
  },
  {
    term: "Amended",
    spellings: /\bamend(ed|ment)s?\b/i,
    plain: "The body changed the file's wording before voting on it. Each change is voted on separately.",
    approved: true,
  },
  {
    term: "Substitute",
    spellings: /\bsubstitute(d)?\b/i,
    plain: "A new version of the file's text replaced the earlier one. The file keeps its number.",
    approved: true,
  },
  {
    term: "Assigned",
    spellings: /\bassigned\b/i,
    plain: "The file was sent to a committee to review before the full Common Council takes it up.",
    approved: true,
  },
  {
    term: "In committee",
    spellings: /\bin committee\b/i,
    plain: "The file is waiting in a committee that has not yet sent it on.",
    approved: true,
  },
];

/** Approved terms that appear in any of the texts, once each, in list order. Exported for tests with other approvals. */
export function termsInFrom(entries: readonly ActionTerm[], texts: string[]): ActionTerm[] {
  return entries.filter((t) => t.approved && texts.some((x) => t.spellings.test(x)));
}

export const termsIn = (texts: string[]) => termsInFrom(ACTION_TERMS, texts);
