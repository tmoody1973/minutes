# 008: Minutes covers all of City Hall, and an Ask box leads

**Date:** 2026-11-02

**Decision:** Minutes follows every file through the Common Council, its eight standing committees and three commissions (City Plan, Fire & Police, Historic Preservation), not only zoning. The home page leads with one box, "Ask about Milwaukee City Hall": Ask Minutes, a Muse Spark agent, answers from the synced records, and any question can be followed so Minutes emails when a matching item is scheduled or decided.

**Why this came up:** Two days before the deadline Tarik judged the zoning-only tracker "a weak entry and a weak tool." The people Minutes serves (residents, organizers, journalists, students) arrive with concerns like the budget or police surveillance cameras, and those live in Finance, Public Safety & Health and the Fire & Police Commission, which Minutes did not read. Getting this wrong meant demoing a narrow product with a strong engine underneath.

**Options:**
1. **Stay zoning-only and polish.** Lowest risk for Wednesday. Cost: the product answers one kind of question, and "Also at City Hall" already showed residents everything else it was ignoring.
2. **Widen the data, keep the zoning-first pages.** Cost: the records are there, but someone with a budget question still lands on a zoning page.
3. **Widen the data and rebuild the front door around asking (chosen).** Cost: the most work in the least time, and answers are written when someone asks.

**What we chose and why:** Option 3. Tarik made the scope call and chose to keep every planned feature; Claude proposed the Ask-first structure and Tarik confirmed it (UX brief, `docs/ux-brief-all-of-city-hall.md`). Topics come from the committee a file goes through, by rule, because Legistar applies its own subject tags only after a file is enacted (verified in Tarik's earlier Gavel project). The Fire & Police Commission is included because police technology policy is debated there.

**What we gave up:** Decision 007 chose summaries written ahead of time so nothing a model wrote reached a reader unread. Ask Minutes writes on demand. The Editor still checks every sentence before it is shown, but no person reads an answer first, and an answer can be slower (several record lookups plus the check). Answers are not stored unless someone presses Share or Follow, because a question can contain a home address. The zoning-specific depth (lot outlines, Near me, the zoning glossary) stays zoning-only.

**How we'll know if this was right:** For five real questions across different committees (the 2027 budget, police cameras, a liquor license, a street project, a rezoning), Ask Minutes returns an answer whose every sentence passes the Editor and cites a file that is in the records, by Wednesday's demo recording.

**What actually happened:**
