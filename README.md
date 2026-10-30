# Minutes

> Milwaukee City Hall, in minutes.

**Built by Tarik Moody, a sitting member of the City Plan Commission. Public records only, no recommendations.**

Entry for the [Meta Global AI Developer Hackathon](https://dev.meta.ai/events/global-hackathon) · Indie developer track · Theme: Build for Your World · Built Oct 29 – Nov 4, 2026.

- **Live app:** _added at deploy (Ship, Task S.2)_
- **Demo video:** _added before submission_

---

## What it does

Milwaukee publishes nearly everything its government does: agendas, files, votes, staff reports and hours of meeting video. Almost nobody can use it. Records are scattered across bodies, meetings run three hours, and nothing tells you which decisions touch your block.

Minutes turns those public records into something a resident can follow at the depth they choose: 30 seconds, 3 minutes, or the full record.

| Feature | What a resident gets | Status |
|---|---|---|
| **Near me** | Type an address, see zoning and development files within half a mile, nearest first, filtered by upcoming hearings or decided. | Built |
| **Project page** | One file's path from introduction to the Mayor: every real step with votes and a jump into the meeting video, the lot outline from city property records, what the zoning would change in plain English with the official definition, the next hearing with an add-to-calendar file, the staff report and exhibit. | Built |
| **Readable meetings** | A three-hour meeting as chapters by agenda item, with the city's own video player jumping to any moment, the lightly cleaned transcript, how each member voted, and public testimony in speaking order. | Built |
| **This week + Watcher** | A short weekly digest and quiet alerts only for hearings and decisions on things you follow. | In progress |

The demo follows **Bookends** (file 260533), a pending rezoning at 711 E. Kilbourn Ave., and **Southgate** (file 260532), a complete journey from Plan Commission to the Mayor's signature.

## How Meta's models are used

| Model | Used for | Status |
|---|---|---|
| **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) | Speaker-labeled transcripts of meeting audio (`mode: DIARIZATION`, 10-minute chunks). | Used: 4 meetings, 8.44 hours, $1.52 |
| **Muse Spark** (`muse-spark-1.3`) | A **confirm-only** check on speaker names (it can reject a proposed name, never invent one), and splitting a hearing into parts: staff presentation, applicant, public testimony, discussion, vote. | Used |
| **SAM 3.1** | Tracing the "subject site" on zoning exhibit maps as a cross-check of lot outlines. | Tried three ways and cut ([decision 002](docs/decisions/002-parcel-outline-from-city-records-sam-as-check.md)); lot outlines come from city records |
| Muse Spark (Editor) | Checking every generated sentence against its sources before it is shown. | Planned (Milestone 7) |
| Muse Voice Transcribe (live) | Ask by voice, English and Spanish. | Planned, first to be cut |

Every model output that reaches a resident is checked by deterministic code or traced to a stored record: speaker names need a roll-call or self-introduction cue, chapter parts must cover every resident who introduced themselves, and a testimony position needs the speaker's own first-person sentence.

## How it stays neutral

The builder sits on the City Plan Commission, which is part of the demo. Neutrality comes from how the product is built, not from leaving the commission out:

- **Records, not opinions.** Every sentence traces to a stored public record: a Legistar history row, a vote, a document, or a timestamped transcript turn.
- **Same treatment for everyone.** The builder's votes and statements render exactly like every other member's; a test proves the vote table's rows are identical in markup.
- **Positions only in people's own words.** A public speaker is shown as "for" or "against" only when they say so plainly, with that sentence quoted beside it. Otherwise: "Position not stated." ([decision 005](docs/decisions/005-testimony-and-positions-only-from-own-words.md))
- **No guessed speakers.** Names come from the roll call and agenda, or a self-introduction marked "name as heard". Anyone else is "Speaker B".
- **Quotes are lightly cleaned only.** The only edit is removing immediately repeated words; every quote links to the raw text and the video moment.
- **Nothing submitted on anyone's behalf.** "How to be heard" links to the city's own instructions.

## Measured so far

| What | Result | Source |
|---|---|---|
| Meetings transcribed | 4 (Sep 28 Plan Commission, Oct 6 and Oct 27 ZND committee, Oct 13 Common Council), 8.44 hours, 53 chunks, 0 failures | `DEVLOG.md` |
| Transcription cost | $1.52 total, about $0.18 per hour | `DEVLOG.md` |
| Address lookup | 0.2 – 2 s through city property records; the U.S. Census geocoder failed 3 of 5 requests the night it was tested | [decision 006](docs/decisions/006-address-lookup-city-records-first.md) |
| Records synced | Legistar every 30 minutes plus nightly; 1,067 matters in the first backfill | `DEVLOG.md` |
| Tests | 616 passing (Vitest, including Convex function tests) | `npm test` |

Fuller metrics (share of turns named, chapters located, Editor rejection rate) come with Milestone 7.

## What was built during the hackathon

Everything in this repository was written between Oct 29 and Nov 4, 2026, during the hackathon.

- **`scripts/phase1/`**: the first day's feasibility checks (Python): Legistar API calls, meeting audio download, chunked transcription with Muse Voice Transcribe, and the first SAM 3.1 test. The transcripts the app shows were produced by `scripts/phase1/transcribe_meeting.py`.
- **Everything else is the product**, built milestone by milestone, each ending in code review, real-data verification and a merge ([`DEVLOG.md`](DEVLOG.md) has one line per milestone):
  1. Legistar sync and Convex store (PR #1), CI (PR #2)
  2. Project timelines, lot outlines from city records, near-me search, zoning glossary (PR #4)
  3. Media pipeline: transcript stitching, speaker naming, chapters, stated positions, captions fallback (merged locally; speaker-review tools in PR #3)
  4. Tracker UI: app shell, Near me, project page (PRs #7–#9)
  5. Readable meeting pages (PR #10)

**Built with [Claude Code](https://claude.com/claude-code)** (Anthropic's coding agent), which wrote the code under the builder's direction; commits are co-authored accordingly. Meta's models run inside the product, as described above.

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind CSS 4 |
| Data and jobs | Convex (database, queries, scheduled sync) |
| AI | Meta Model API: Muse Voice Transcribe, Muse Spark |
| Public data | Milwaukee Legistar web API, Granicus meeting video, MPROP and the city parcel map, Milwaukee Code of Ordinances ch. 295 |
| Tests and CI | Vitest, `convex-test`, GitHub Actions (typecheck, test, build) |

## Run it locally

**Prerequisites:** Node.js 24 (what CI uses), npm, and a free [Convex](https://convex.dev) account. A Meta Model API key is needed only to transcribe new meetings.

```bash
git clone https://github.com/tmoody1973/minutes.git
cd minutes
npm install
npx convex dev --once     # sign in, create a dev deployment, write .env.local
npm run dev               # http://localhost:3000
```

Sync public records into your dev deployment (Legistar is open; no key needed):

```bash
npx tsx scripts/sync-once.ts
```

| Variable | What it is | Needed for |
|---|---|---|
| `CONVEX_DEPLOYMENT` | Your Convex deployment, written by `npx convex dev` | Everything |
| `NEXT_PUBLIC_CONVEX_URL` | Convex URL the browser connects to, written by `npx convex dev` | Everything |
| `META_API_KEY` | Meta Model API key | Transcribing and ingesting meetings |

**Meetings:** meeting audio and transcripts are not in the repository (`data/` is ignored). To make a meeting readable: download its audio (see [decision 001](docs/decisions/001-meeting-audio-via-browser-download.md)), transcribe it with `scripts/phase1/transcribe_meeting.py`, then run `npx tsx scripts/ingest-meeting.ts <eventId>`. If there is no local transcript, `--captions` lets the city's machine captions stand in, labeled as such on the page.

**Speaker review:** `npx tsx scripts/speakers.ts list <eventId>` shows each voice with its agenda item and a video link; `set`, `hide` and `clear` correct names without re-ingesting.

```bash
npm test             # Vitest
npm run typecheck    # Next route types + tsc
npm run build        # production build
```

## Project structure

```
app/                 Next.js routes: (site)/ near, files/[file], meetings/[eventId], following
convex/              Schema, public queries (filesNear, fileView, meetingView, meetingList), sync jobs, crons
lib/legistar/        Legistar client, parsers, vote tallies
lib/geo/             Address parsing, MPROP and parcel lookups, geocoding, distances
lib/timeline/        A file's steps from history rows and agenda items
lib/media/           Transcript stitching, speaker cues and naming, chapters, positions, quote cleaning
lib/zoning/          Zoning change parsing and the ch. 295 glossary
lib/ui/              Display helpers for each page
scripts/             Sync, ingest and speaker-review commands; phase1/ feasibility scripts
docs/decisions/      Decision log, in plain English
docs/screens/        Real-data screenshots at 390 and 1440 px
mockups/             The design mockups the UI was built from
tests/               Vitest suites mirroring lib/, convex/ and app/
```

## Decisions

Each non-obvious choice is written up in plain English, with the options, the cost of the chosen one, and how we'll know if it was right:

1. [Meeting audio via browser download](docs/decisions/001-meeting-audio-via-browser-download.md)
2. [Lot outlines from city records; SAM as a check](docs/decisions/002-parcel-outline-from-city-records-sam-as-check.md)
3. [No Vercel Sandbox](docs/decisions/003-no-vercel-sandbox.md)
4. [Muse Spark confirms speaker names, never proposes them](docs/decisions/004-muse-spark-confirms-speaker-names-never-proposes.md)
5. [Testimony and positions only from people's own words](docs/decisions/005-testimony-and-positions-only-from-own-words.md)
6. [Address lookup through city records first](docs/decisions/006-address-lookup-city-records-first.md)

## License

[MIT](LICENSE) © 2026 Tarik Moody. Public records shown by the app belong to the City of Milwaukee; meeting video is served by the city's own player and is not hosted here.
