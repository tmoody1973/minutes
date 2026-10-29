# 004: Muse Spark checks speaker names; it never suggests them

**Date:** 2026-10-29

**Decision:** Speaker names come only from evidence in the transcript itself (someone introducing themselves, or the chair calling on someone by name), matched to the official roster. Muse Spark reads each candidate in context and can confirm or reject it, but it can never add a name or change one.

**Why this came up:** The plan had the Speaker Matcher agent (Muse Spark) propose names and a checker accept them. But Minutes promises no guessed speakers: a name may appear only when the recording itself supports it. A checker that strict would accept exactly the cue-based names and nothing else, so a proposing agent adds nothing but risk.

Then real data showed a harder problem. The transcription service labels voices per 10-minute chunk, and one label can hold two people. In the Sep 28 Plan Commission meeting, one label answered a commissioner's roll call ("Present") and also carried a city planner's staff report. Naming that label from the roll call put a staff recommendation in a commissioner's mouth.

**Options:**
1. **Muse Spark proposes names; code checks them.** The plan as written. Cost: under the no-guessing rule the model's proposals are either redundant or rejected, and a mistake is a real person's name on someone else's words.
2. **Code proposes from transcript evidence; Muse Spark confirms or rejects.** The model sees every turn under that voice label in the chunk and rejects when the turns sound like more than one person. Cost: fewer automatic names, and one model call per candidate.
3. **No model at all.** Cost: the roll-call/staff-report mix-up gets through, and the project loses a visible Meta model role.

**What we chose and why:** Option 2, Claude's ruling, applied after the final code review found the mixed label. The model can only remove a name, never introduce one, so its worst case is a missing name. Every model decision is stored with its reason and reused, so names don't change between runs. Tarik reviews every automatic name before it is shown, and can rename, or hide a label so it shows as "Speaker B".

**What we gave up:** Most speakers stay unnamed automatically (about 3–5% of turns are named). The chair and city staff are rarely introduced on the record, so the readable meeting depends on Tarik's manual review for them.

**How we'll know if this was right:** In Tarik's review of all automatically named labels across the four demo meetings, zero names are wrong. Every name shown in the demo traces to a roster match, a self-introduction, or a recorded manual decision.

**What actually happened:**
