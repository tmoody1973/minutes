# 005: Testimony positions come only from the speaker's own words, and testimony must actually contain the testimony

**Date:** 2026-10-29

**Decision:** A public speaker is shown as "for" or "against" only when they say so plainly in the first person about the item itself ("I oppose this rezoning"), with that sentence quoted beside the label. Anything else shows "Position not stated." Separately, when Muse Spark splits a hearing into parts (staff presentation, applicant, public testimony, discussion, vote), every resident who introduces themselves must land inside "testimony", or the split is rejected.

**Why this came up:** The demo's central moment is a resident jumping straight to public testimony on a project near them, names and all. Two things could quietly misrepresent real neighbors:

- **Positions.** Real Plan Commission audio is full of near-misses: the chair saying "all those in favor, say aye", "is he for or against it", "I'm not sure I support this", "He thinks we oppose this".
- **The model's split.** On the Bookends hearing, its first split was structurally valid but marked only 3 minutes as testimony, while residents were introducing themselves across more than 20 minutes.

**Options:**
1. **Let Muse Spark judge positions and parts freely.** Cost: confident wrong labels on real people.
2. **Strict, testable rules.** Positions come from a fixed set of first-person patterns that block negation, hedges, reported speech and other people's words. Parts must pass a coverage check built on self-introductions. Cost: some real stances show "Position not stated", and some chapters show no parts.
3. **Skip positions and parts entirely.** Cost: loses the testimony feature the demo is built around.

**What we chose and why:** Option 2, Claude's rulings, refined over several review rounds. Each round of review found a sentence shape that produced a wrong label; each became a permanent test (about 60 real and probe sentences). For parts, the model gets one retry, told exactly which resident fell outside testimony; if it still fails, the chapter shows no parts rather than wrong ones. The neutrality promise is that we never put a position in someone's mouth; missing one is acceptable.

**What we gave up:** Residents who state a position inside a longer sentence ("I told her I oppose this project") show "Position not stated." A hedge before "but" is ignored ("I'm not sure, but I support this" counts as for).

**How we'll know if this was right:** On the Bookends and Southgate hearings, every for/against label checks out against the recording, and the testimony part starts before the first resident speaks and ends after the last.

**What actually happened:**
