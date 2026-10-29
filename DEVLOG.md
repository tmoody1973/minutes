# DEVLOG

Proof of what was built during the hackathon. One line per milestone: date · built · verified.

- 2026-10-29 · Phase 1 input checks (`scripts/phase1/`) · Legistar bodies found (Council 1, ZND 11, CPC 272); one MatterId links CPC→ZND→Council (file 260532); Granicus video downloadable via browser only; Muse Voice Transcribe file endpoint with diarization on 4 full meetings (8.44 h, 53 chunks, 0 failures, $1.52); SAM 3.1 tested on exhibit map (picked wrong outline); MPROP→parcel outline verified for 3473 S. 27th St.
- 2026-10-29 · Task 1.1 scaffold (Next.js 16, Convex, Vitest) · smoke test, typecheck and build pass; Convex dev deployment connected
- 2026-10-29 · Milestone 1: Legistar sync + Convex store (parsers, tallies, idempotent upserts, change log, scheduled sync, memberships) · 43 tests + typecheck pass; dev sync: 37 events since Jan 1, 1,067 matters, Council roster 15, Southgate Council tally 13/0/2, Bookends CPC 9/28 + ZND 10/27 steps; writes internal-only; final opus review fixes applied
- 2026-10-29 · CI: GitHub Actions typecheck + test + build on PRs and main (PR #2) · proven green → red → green
- 2026-10-29 · Milestone 3: media pipeline (stitch, quote cleaning, speaker cues, roster-matched naming with Muse Spark as confirm-only checker, chapters + Muse Spark parts with testimony-coverage check, stated positions, captions fallback, Convex ingest, speakers review CLI with hide) · 293 tests + typecheck; 4 meetings ingested (8.44 h, 2,621 turns); Bookends testimony parts cover every resident self-introduction; Muse Spark rejected 4 mixed-voice labels incl. a commissioner name on a staff report; re-ingest reuses stored decisions (0 new calls); final Opus review fixes applied
