# 007: Plain-language summaries are written ahead of time, checked one sentence at a time, and give vote counts instead of names

**Date:** 2026-11-01

**Decision:** Each project page and each meeting chapter about a file gets a one- or two-sentence summary in plain English. A script writes them ahead of time with Muse Spark (the "Clerk" agent), and a second, separate Muse Spark check (the "Editor") must approve every sentence against the records it cites before it is saved. Summaries give vote counts ("5 aye, 0 no, 2 excused") and never name individual members.

**Why this came up:** The brief promises that every sentence a resident reads points back to a public record, and that the Editor rejects anything unsupported or evaluative. Until now nothing on the site was written by a model, so that promise was untested. The summaries are also where a sitting Plan Commission member's tool is most exposed: one sentence that sounds like a judgment, or that singles out how one member voted, undercuts the whole neutrality story.

**Options:**
1. **Write summaries live, when someone opens a page.** Always current. Cost: a model call on every page view, a slower page, and no chance to read what it wrote before a resident does.
2. **Write ahead with a script, Editor-gated, names allowed.** Cost: summaries are only as fresh as the last run, and a sentence like "Ald. X voted no" puts individual members in the spotlight, including Tarik.
3. **Write ahead with a script, Editor-gated, counts only.** Cost: summaries go stale until the script is re-run (it skips any card whose records have not changed, so re-running is cheap), and residents who want to know who voted how have to read the vote table, which already lists every member the same way.

**What we chose and why:** Option 3. Claude made this call while building; Tarik chose the scope (both files and chapters) and has not yet weighed in on counts versus names. Writing ahead means every summary can be read before the demo, and the record of every Editor verdict feeds the rejection-rate metric. Counts keep the summary from singling anyone out, and the per-member vote table already treats every member the same way.

How the check works: the Editor sees only one sentence and the records that sentence cites, never the writer's instructions or the other sentences. Before the model is asked anything, code rejects a sentence that cites nothing, cites a record it was not given, or uses a word from a fixed list of judging words ("welcome", "much-needed", "controversial", "should"...).

**What we gave up:**
- Freshness: a summary reflects the records as of the last script run, not the last sync.
- Some plain-language reach: the writer is told not to explain zoning terms (that is the glossary's job, with the official wording), so a summary says "a multi-family residential building" rather than explaining what a Detailed Planned Development is.
- The Editor uses the same model family as the writer. A trap test (below) shows it catches planted errors, but it is not an independent human check.

**How we'll know if this was right:** The trap test in `scripts/editor-eval.ts` plants six known errors in sentences about Bookends (wrong vote count, wrong date, an invented reason, a prediction, a judging word, a claim the records do not make) plus two correct sentences. On 2026-11-01 it scored 8 of 8: every planted error was rejected with a specific reason, and both correct sentences passed. It should still score 8 of 8 before the demo, and a read of 20 random summaries should find none that state something the records do not.

**What actually happened:**
