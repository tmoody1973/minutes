# Minutes

> Milwaukee City Hall, in minutes.

**Built by Tarik Moody. Public records only, no recommendations.**

Built Oct 29 – Nov 4, 2026, during the [Meta Global AI Developer Hackathon](https://dev.meta.ai/events/global-hackathon).

- **Live app:** https://minutes-rust.vercel.app
- **Video:** _coming soon_

---

## What it does

Milwaukee publishes nearly everything City Hall decides: agendas, files, votes, staff reports and hours of meeting video. Almost nobody can use it. One file's records are spread across a committee, the full Common Council and sometimes a commission. Meetings run three hours. Nothing tells you which files touch what you care about, when they will be heard, or how to speak up before it is decided.

Minutes reads the records of the Common Council, its eight standing committees and the City Plan, Fire & Police and Historic Preservation commissions, and lets anyone follow them at the depth they choose: a plain answer, a file's whole path, or the meeting video at the moment it happened. It is for residents, organizers, journalists and students.

| Feature | What you get |
|---|---|
| **Ask Minutes** | Type a question ("What has the city done about police surveillance cameras?"). Muse Spark looks things up in the synced records, including the text of the PDFs attached to files (staff reports, police policies, contracts), and answers in two to five plain sentences. Every sentence shows the files it came from, and a box explains the city's procedural terms ("held to call of the chair"). Sentences the records don't support are dropped before you see them. |
| **Follow this** | Under every answer, Minutes proposes a few words to watch for in new file titles. Edit them, sign in, follow. Minutes emails you only when a matching file is introduced, put on an agenda or decided. Introduction comes first, usually weeks before a hearing, which is when there is still time to organize. Only the name and the words are saved, never the question. |
| **File pages** | One file's path from introduction to the Mayor: every real step with its vote, a jump into the meeting video, the next hearing with an add-to-calendar file, **who decides** (each member, and for the Council each alder's district, email and city page) and **how to be heard** in that body's own published words, and for zoning files the lot outline and what the zoning would change. |
| **Meetings** | Every synced meeting, with its agenda and what was decided: each item's actions and vote count, who moved it, the clerk's note from the minutes, and a jump into the city's video. Coming-up meetings also show how to be heard and who decides. Meetings are split into chapters with a transcript wherever one exists: four transcribed with speaker names, the rest from the city's own captions. |
| **This week** | Files on an agenda in the next seven days and decisions from the last seven, sorted by topic. |
| **Near me** | Type an address, see zoning and development files within half a mile. The address is used for the lookup and never stored. |
| **Search** | Files and words said in meetings. |

**Try it:** ask one of the home page examples: police surveillance cameras, where the 2027 budget is, or liquor licenses this month. Then open a cited file, or follow the concern.

## How Meta's models are used

| Model | Used for |
|---|---|
| **Muse Spark** (`muse-spark-1.3`), as the **Ask agent** | Answers questions with four tools over the synced records: `find_files`, `read_file` (steps, votes, upcoming agendas), `find_moments` (words said in meetings), `find_in_documents` (passages from files' attached PDFs) and `upcoming`. It also proposes the watch words for Follow this. Up to four lookup rounds, then a JSON answer with each sentence's record keys. |
| **Muse Spark**, as the **Editor** | Sees one sentence and only the records it cites, and rejects anything they don't state or any word that takes a side. Code runs first (no source, unknown source, judging-word list), then the model check. A sentence sent back for wording gets one rewrite, which is checked again. ([decision 007](docs/decisions/007-plain-language-cards-written-ahead-checked-sentence-by-sentence.md)) |
| **Muse Spark**, as the **Clerk writer** | One or two plain sentences per file and per meeting chapter, written ahead and saved only when the Editor approves every one (188 cards). |
| **Muse Spark**, as a **check on speaker names** | Confirm-only: it can reject a proposed name, never invent one ([decision 004](docs/decisions/004-muse-spark-confirms-speaker-names-never-proposes.md)). It also splits a hearing into presentation, testimony, discussion and vote. |
| **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) | Speaker-labeled transcripts of meeting audio (`mode: DIARIZATION`, 10-minute chunks): 4 meetings, 8.44 hours, $1.52. |
| **SAM 3.1** | Tried three ways to trace lots on zoning exhibit maps, and cut ([decision 002](docs/decisions/002-parcel-outline-from-city-records-sam-as-check.md)). Lot outlines come from city property records. |

Voice questions in English and Spanish were planned and cut for time.

## How it stays neutral

Neutrality comes from how the product is built:

- **Records, not opinions.** Every sentence traces to a stored public record: a Legistar history row, a vote, a document, or a timestamped transcript turn.
- **Same treatment for everyone.** Every member's votes and statements render exactly alike; a test proves the vote table's rows are identical in markup.
- **Positions only in people's own words.** A public speaker is shown as "for" or "against" only when they say so plainly, with that sentence quoted beside it. Otherwise: "Position not stated." ([decision 005](docs/decisions/005-testimony-and-positions-only-from-own-words.md))
- **No guessed speakers.** Names come from the roll call and agenda, or a self-introduction marked "name as heard". Anyone else is "Speaker B".
- **Quotes are lightly cleaned only.** The only edit is removing immediately repeated words; every quote links to the raw text and the video moment.
- **Nothing submitted on anyone's behalf.** "How to be heard" links to the city's own instructions.
- **Questions are never stored.** Ask's question is used to answer and then dropped; it can hold a home address. A follow saves only its name and words.
- **Vote counts, not names, in summaries.** Generated sentences give counts. Each member's vote is shown only as the record itself, in the vote table.

## Measured so far

| What | Result | Source |
|---|---|---|
| Records synced | Legistar every 30 minutes plus nightly; 1,817 files in the dev database on Nov 3 | `scripts/metrics.ts` |
| A real alert | File 260809 (license plate reader contracts) passed the Common Council at its 9 AM meeting on Nov 4; the follower's email arrived at 11:34 AM, from the city's own record of the vote | Resend email |
| Documents Ask can read | 1,549 PDFs attached to files active since Sep 1 on production; 1,324 with text, 225 scans with none (stored empty, not guessed at); about 30,000 passages | `scripts/ingest-docs.ts` |
| Meetings transcribed | 4 (Sep 28 Plan Commission, Oct 6 and Oct 27 ZND committee, Oct 13 Common Council), 8.44 hours, 53 chunks, 0 failures | `DEVLOG.md` |
| Meetings with chapters | 148 on production (Nov 4): 4 with Muse Voice Transcribe transcripts, 144 from the city's captions (0 model calls). Without chapters: 33 with no posted video, 6 with empty captions, 21 over 7,500 caption lines; those show their agenda and outcomes from the records | `scripts/ingest-captions-all.ts` |
| Transcription cost | $1.52 total, about $0.18 per hour | `DEVLOG.md` |
| Editor trap test | 8 of 8 planted errors caught (wrong count, wrong date, invented reason, prediction, judging word, unsupported claim); both correct sentences passed | `scripts/editor-eval.ts` |
| Editor in use | 5 of 378 written sentences rejected (1.3%), for example "…sold to Vliet Street Lofts, LLC": the records authorize accepting an offer, not a completed sale | `scripts/metrics.ts` |
| Ask reliability | Each home page example asked 3 times on production; all 9 answered with cited sentences | `DEVLOG.md` |
| Speaker naming | 3.9% of transcript turns named; the rest show as "Speaker B" until reviewed | `scripts/metrics.ts` |
| Tests | 725 passing (Vitest, including Convex function tests) | `npm test` |

## What was built during the hackathon

Everything in this repository was written between Oct 29 and Nov 4, 2026, during the hackathon.

- **`scripts/phase1/`**: the first day's feasibility checks (Python): Legistar API calls, meeting audio download, chunked transcription with Muse Voice Transcribe, and the first SAM 3.1 test. The transcripts the app shows were produced by `scripts/phase1/transcribe_meeting.py`.
- **Everything else is the product**, built milestone by milestone, each ending in code review, real-data verification and a merge ([`DEVLOG.md`](DEVLOG.md) has one line per milestone):
  1. Legistar sync and Convex store (PR #1), CI (PR #2)
  2. Project timelines, lot outlines from city records, near-me search, zoning glossary (PR #4)
  3. Media pipeline: transcript stitching, speaker naming, chapters, stated positions, captions fallback (merged locally; speaker-review tools in PR #3)
  4. Tracker UI: app shell, Near me, project page (PRs #7–#9)
  5. Readable meeting pages (PR #10)
  6. Watcher: follows, alerts, email (PR #12)
  7. Editor and Clerk writer (PR #13); batched sync writes (PR #14); landing and About pages (PR #15)
  8. All of City Hall and Ask Minutes ([decision 008](docs/decisions/008-all-of-city-hall-ask-first.md), PR #17)
  9. Ask reliability, honest votes, Follow this, plain answers and the action-terms box, demo replay, all-of-City-Hall copy (PRs #18–#24)
  10. Every meeting listed with its agenda and the minutes' own words, video beside the content, chapters from city captions (PRs #26–#27)
  11. Alerts when a file is introduced, who decides and alder contacts, how to be heard, Ask reading attached PDFs, caption chapters for every meeting with captions (PR #29)

**Built with [Claude Code](https://claude.com/claude-code)** (Anthropic's coding agent), which wrote the code under the builder's direction; commits are co-authored accordingly. Meta's models run inside the product, as described above.

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind CSS 4 |
| Hosting | Vercel |
| Data and jobs | Convex (database, queries, scheduled sync, the Watcher) |
| Sign-in and email | Clerk, Resend |
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

Sync public records into your dev deployment (Legistar is open; no key needed), then try Ask from the terminal:

```bash
npx tsx scripts/sync-once.ts
npx tsx scripts/ask.ts "Where is the 2027 city budget in the process?"
```

| Variable | What it is | Needed for |
|---|---|---|
| `CONVEX_DEPLOYMENT` | Your Convex deployment, written by `npx convex dev` | Everything |
| `NEXT_PUBLIC_CONVEX_URL` | Convex URL the browser connects to, written by `npx convex dev` | Everything |
| `META_API_KEY` | Meta Model API key (in `.env.local`, Vercel and Convex) | Ask Minutes, writing cards, transcribing meetings |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk keys | Signing in to follow |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex env: Clerk issuer, so Convex trusts the sign-in | Follows and alerts |
| `RESEND_API_KEY`, `SITE_URL` | Convex env: alert email and the links inside it | Alert email (alerts still show on the site without them) |
| `ADMIN_USER_IDS` | Convex env: Clerk user ids allowed to replay a real past alert to themselves | Demos |

**Meetings:** meeting audio and transcripts are not in the repository (`data/` is ignored). To make a meeting readable: download its audio (see [decision 001](docs/decisions/001-meeting-audio-via-browser-download.md)), transcribe it with `scripts/phase1/transcribe_meeting.py`, then run `npx tsx scripts/ingest-meeting.ts <eventId>`. If there is no local transcript, `--captions` lets the city's machine captions stand in, labeled as such on the page.

**Documents and captions in bulk:** `npx tsx scripts/ingest-docs.ts` stores the text of PDFs attached to active files (needs `pdftotext` from poppler; no model calls). `npx tsx scripts/ingest-captions-all.ts` turns the city's captions into chapters for every past meeting that has them (no model calls).

**Speaker review:** `npx tsx scripts/speakers.ts list <eventId>` shows each voice with its agenda item and a video link; `set`, `hide` and `clear` correct names without re-ingesting.

```bash
npm test             # Vitest
npm run typecheck    # Next route types + tsc
npm run build        # production build
```

## Project structure

```
app/                 Next.js routes: (site)/ home + ask, week, files/[file], meetings/[eventId], near, search, following, about; api/ask
convex/              Schema, public queries (filesNear, fileView, meetingView, meetingList), sync jobs, crons
lib/ask/             Ask Minutes: the Muse Spark agent loop, its tools and the follow proposal
lib/editor/          The Editor: code checks, then the Muse Spark check
lib/watcher/         Follow matching and alert wording
lib/legistar/        Legistar client, parsers, vote tallies, what the city's action terms mean
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
7. [Plain-language cards written ahead, checked sentence by sentence](docs/decisions/007-plain-language-cards-written-ahead-checked-sentence-by-sentence.md)
8. [All of City Hall, Ask first](docs/decisions/008-all-of-city-hall-ask-first.md)

## License

[MIT](LICENSE) © 2026 Tarik Moody. Public records shown by the app belong to the City of Milwaukee; meeting video is served by the city's own player and is not hosted here.
