# 002: Draw the project's lot from city property records; SAM 3.1 checks the exhibit map

**Date:** 2026-10-29

**Decision:** The "where exactly" outline on each project comes from the city's property records (MPROP plus the city's parcel map layer). SAM 3.1, Meta's image segmentation model, reads the file's exhibit map as a cross-check, time-boxed to about two hours.

**Why this came up:** The brief planned for SAM 3.1 to find the outlined lot on each file's exhibit map. In Phase 1, SAM found nothing for "outlined parcel," and for "dashed line" it picked the larger yellow development boundary instead of the blue subject site. Showing the wrong lot to a resident is worse than showing none.

**Options:**
1. **SAM only, as the brief planned.** Shows off a Meta model. Cost: it picked the wrong outline in our one test, and fixing that needs extra work with no guarantee.
2. **City records only.** The address on the file is looked up in MPROP (the city's master property table), which gives a tax key (the parcel's ID number); the tax key is looked up in the city's parcel map service, which returns the exact lot boundary. No model guessing. Cost: no Meta model in this feature, and it misses cases where a file covers part of a lot or several lots.
3. **Both, with different jobs.** City records are the source of truth for the outline; SAM reads the exhibit map to flag when the drawn area doesn't match the lot. To make SAM find the right shape, a simple color match locates the blue "subject site" line and hands SAM that box to trace.

**What we chose and why:** Option 3, raised by Tarik (MPROP) and shaped by Claude (SAM's role); joint call. City records fit the project's rule that every fact traces to a stored record. Phase 1 confirmed the chain end to end for file 260532: address 3473 S. 27th St. → tax key 5331104000 → a 10-point lot outline, with zoning (PD), alder district (11) and lot size (4.6 acres) matching both Legistar and what the applicant said in the meeting.

**What we gave up:** SAM moves from the hero feature to a supporting check, which makes Meta model use slightly less visible in this part of the demo. If the two-hour box runs out, SAM is cut from this feature entirely.

**How we'll know if this was right:** On every demo project, the drawn lot matches the subject site on the file's exhibit map when checked by eye. If SAM ships, it agrees with the city outline or correctly flags the ones that differ.

**What actually happened:**
