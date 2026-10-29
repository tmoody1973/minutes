# Minutes: design after Phase 1 and Phase 2

**Date:** 2026-10-29 · **Owner:** Tarik Moody · **Deadline:** Wed Nov 4, 2026, 9:00 PM ET

`minutes.md` (repo root) is the base brief: the idea, users, features, agents, neutrality rules, build plan (section 11) and cut order. This document records what Phase 1 verified and what Tarik decided in Phase 2. **Where the two disagree, this document wins.** Read `minutes.md` first, then this.

## 1. Intent, in one line

Make Milwaukee's public land-use records followable by a resident at the depth they choose, with every sentence traceable to a stored public record, built and disclosed by a sitting City Plan Commission member.

## 2. The demo spine (decided)

The demo follows **Bookends** (Legistar file **260533**, MatterId **74560**): a rezoning from General Planned Development "Bookends" to Detailed Planned Development "Zenith" for a multi-family residential building at 711 E. Kilbourn Ave. / 822 N. Van Buren St.

- Path so far: Council assigns (Jul 31) → ZND referral → **Plan Commission, Sep 28** (approved conditionally; 63-minute hearing, ~299 transcript turns, residents testifying) → **ZND, Oct 27** (recommended for passage) → **Council vote not yet scheduled** (status "In Council-Passage").
- It is pending, which gives the demo a real "how to be heard" moment and a real Watcher alert when Legistar posts the Council date.
- Tarik voted on it at the Plan Commission and is fine featuring it. The disclosure must be prominent on every Bookends screen.

**Second example: Southgate** (file **260532**, MatterId **74559**), a complete journey: Plan Commission Sep 28 → ZND Oct 6 → Council passed Oct 13 → Mayor signed Oct 15.

## 3. What Phase 1 verified (facts the build can rely on)

**Legistar** (`https://webapi.legistar.com/v1/milwaukee`, open, no key)
- Body IDs: Common Council `1`, ZND committee `11`, City Plan Commission `272`.
- One `MatterId` carries every step across all bodies. `matters/{id}/histories` gives date, body, action, passed flag, and `MatterHistoryEventId` linking the step to its meeting.
- `MatterHistoryTally` and `EventItemTally` are always empty. **Compute tallies** from `eventitems/{EventItemId}/votes` (per-person `VoteValueName`: Aye, No, Excused…).
- Item-level `rollcalls` return empty; meeting-level roll calls are unchecked.
- `EventItemVideoIndex` = seconds into the meeting video where the item starts (e.g. Southgate at 829 s). Some items (one Council item checked) have none.
- `EventVideoPath` is always null. `EventMedia` = the **Granicus clip id**.
- Attachments (`matters/{id}/attachments`) are direct PDF links that scripts can download: exhibit maps, staff reports, etc.

**Meeting video (Granicus)**
- Player: `https://milwaukee.granicus.com/player/clip/{clip}?view_id=2&redirect=true`. The page contains the direct archive MP4 URL and an official "Video Download" button.
- The MP4 and HLS stream return **403 to scripts** and download normally in a real browser. See decision 001.
- Free machine captions: `https://milwaukee.granicus.com/videos/{clip}/captions.vtt`. Rough, `>>` marks speaker changes, no names.

**Muse Voice Transcribe** (`muse-voice-transcribe-1.0`)
- File endpoint works: `POST https://api.meta.ai/v1/asr/transcribe`, multipart `request` (JSON: `model`, `mode: "DIARIZATION"`, `audioEncoding: "WAV"`, `languageBias: ["en"]`) + `audio` (mono 16-bit PCM WAV, 16 kHz). Bearer `META_API_KEY`.
- Hard limits: **600 s** and 32 MB per request. A 600.01 s file was rejected, so **chunks are 595 s**.
- Response: `turns[]` with `startMs`, `endMs`, `transcript`, `speaker` (A, B, …). Labels are only valid within one request, so they reset every chunk.
- Measured: 4 full meetings, 8.44 h, 53 chunks, 0 failures, **$1.52** total (= $0.18/h). ~3% of turns arrive unlabeled. ~3.6% of words are doubled. Names and acronyms get mangled ("DCDCD", "raised" for "razed").
- Speakers introduce themselves ("My name is…", "[name], Planning") and the chair calls on people by name: the cues the Speaker Matcher needs.

**Other Meta models** (confirmed in `GET /v1/models` for this key): `muse-spark-1.3`, `muse-wonder-1.0`, `muse-image-1.0`, `sam-3.1`.

**SAM 3.1**: `POST /v1/responses`, model `sam-3.1`, an `input_text` prompt + `input_image` (inline base64 data URL works). Output is a token stream (`<0f>id<|box;…|><|mask;…|>`), not JSON. Text prompts on the zoning exhibit map failed to isolate the blue subject site ("dashed line" returned the larger yellow boundary). SAM also accepts **box/point prompts** (docs: dev.meta.ai/docs/sam/segmenting).

**City property data**
- MPROP (master property table), queryable by SQL: `https://data.milwaukee.gov/api/3/action/datastore_search_sql`, resource `0a2c7f31-cd15-4151-8222-09dd57d5f16d`. Columns are text, so cast house numbers. Gives `TAXKEY`, address range, `ZONING`, `GEO_ALDER`, `LOT_AREA`, owner. Updated daily.
- Parcel outlines: `https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/property/parcels_mprop/MapServer/2/query?where=TAXKEY='…'&outSR=4326&f=geojson`.
- Verified for Southgate: 3473 S. 27th St. → tax key 5331104000 → 10-vertex polygon. Zoning, district and lot size match Legistar and the meeting.

## 4. Decisions made in Phase 2

| # | Decision | Detail |
|---|---|---|
| 001 | Meeting audio via browser download | Real browser presses the city's Download button; audio extracted, video deleted. No disguised requests. Hands-off ingestion is out of scope until the city grants access. |
| 002 | Lot outline from city records; SAM as a check | MPROP → tax key → parcel polygon is the source of truth. SAM gets a box from a simple color match on the blue "subject site" line and traces it; flags files whose drawn area differs from the lot. **SAM is time-boxed to ~2 hours, should tier.** |
| 003 | No Vercel Sandbox | Mac for the hackathon; Hetzner if anything must run unattended later. |
| — | Demo spine | Bookends primary, Southgate secondary (section 2). |
| — | Alerts | **On the site** (an inbox/bell) **and by email** (Resend, to the user's Clerk sign-in address). Same quiet rule: at most one per real change (hearing scheduled, decision made) to something they follow. Unsubscribe link in every email. |
| — | Accounts | Browsing is open to everyone. **Following, watch lists and alerts require Clerk sign-in.** |
| — | Quotes | **Lightly cleaned, with links to raw text.** The only allowed edits: (1) remove immediately repeated words; (2) correct a name, body or file number only when it matches a Legistar record exactly. No model rewrites quote text. Each quote shows "Lightly cleaned machine transcript · view raw · watch this moment" (link to the video at the turn's timestamp). |
| — | Fresh build | All product code is written this week. **gavel-slack-agent is reference only; nothing is copied.** The Phase 1 scripts in `scripts/phase1/` were written during the event and may be reused. The README states what was built during the hackathon. |
| — | When a speaker gets a name | (a) Legistar people matched from transcript cues (roll call, "the chair recognizes…"); (b) **a self-introduction in the transcript** ("My name is…"), shown with a small **"name as heard"** marker because the spelling may be wrong; (c) **Tarik's manual review** of the four demo meetings, each fix stored with who made it and when. Anyone else stays "Speaker B". |
| — | Watcher alert if no live change by demo day | The demo shows a real alert if Legistar posts the Bookends Council date (or a vote) in time. If not, it **replays a real past change** (Southgate's Council vote, Oct 13), clearly labeled "Replay of a real alert from Oct 13". The Watcher needs a replay mode that re-runs its matching against a stored past change; it never fabricates one. |
| — | Testimony "for" / "against" | **Only the speaker's own words count** ("I'm here to support…", "I oppose…"), with that sentence quoted beside the label. Otherwise "Position not stated". No model judgment of position. Speakers are listed in the order they spoke. |
| — | Disclosure | One standard line on every project and meeting screen, the About page and the README: "Built by Tarik Moody, a sitting member of the City Plan Commission. Public records only, no recommendations." On items Tarik voted on, his vote appears in the vote table **exactly like every other member's**, with no special callout. |

## 5. Data already captured (reuse, don't re-fetch)

Raw per-chunk transcripts in `data/transcripts/{EventId}/chunk_NNN.json` (each has `index`, `offsetMs`, `turns[]`), full 16 kHz audio in `data/audio/{EventId}.wav`. Not stitched, speakers not matched across chunks. `data/` is git-ignored.

| EventId | Meeting | Hours | Chunks |
|---|---|---|---|
| 13559 | City Plan Commission, Sep 28 (Southgate + Bookends) | 3.49 | 22 |
| 13445 | ZND, Oct 6 (Southgate) | 1.73 | 11 |
| 13429 | Common Council, Oct 13 (Southgate passed) | 1.12 | 7 |
| 13446 | ZND, Oct 27 (Bookends) | 2.10 | 13 |

## 6. Goals, non-goals, anti-goals

**Goals:** the must-ships in `minutes.md` section 5 (development tracker, readable meetings, This week + Watcher), finished on phone and laptop, demoed on Bookends.

**Non-goals (this week):** automatic ingestion of new meeting video; SMS or push alerts; Vercel Sandbox; submitting anything on a user's behalf; meetings beyond the four above unless time allows (they show captions, labeled, instead).

**Anti-goals (a failure even if it works):**
- any invented or real-looking placeholder Milwaukee data
- a guessed speaker name
- an evaluative sentence
- a quote reworded by a model
- getting around a host's access controls
- commissioners, including Tarik, shown differently

## 7. Constraints

- Stack: Next.js on Vercel, Convex (data + scheduled jobs), Clerk (sign-in), Resend (email). Ask Tarik before changing.
- Laptop disk is ~95% full (~19 GB free): process one meeting video at a time and delete it.
- Transcription chunks ≤ 595 s; labels reset per chunk.
- Mockups in `mockups/` are the visual source of truth (canvas format; read for layout, copy, color, type). Design tokens are listed in KICKOFF.md Phase 4.

## 8. Left to the builder (sensible defaults, change if needed)

- **Chunk stitching and cross-chunk speaker matching:** whether to re-chunk with overlap. Re-transcribing costs ~$0.18/h; the 8.44 h on hand would cost ~$1.50 again.
- Map library and tiles (default: MapLibre with free OpenStreetMap-based tiles).
- "Near you" default radius (default: half a mile, adjustable) and how a user's address is geocoded (MPROP address match first, US Census geocoder as fallback).
- How far back the Legistar sync reaches (default: matters and events from Jan 1, 2026, for the three bodies, plus anything linked to a followed file).
- Pulling the address out of a matter title for the MPROP lookup.
- Exact data model, building on `minutes.md` section 8.

**Claude's calls (made while writing this; Tarik to check):**
- **"Watch this moment" uses the city's Granicus player** at the turn's timestamp (`starttime` parameter), embedded where the player allows it, otherwise linked. We do not host meeting audio or video ourselves (consistent with decision 001). Trade-off: the transcript can't scroll along with playback. Clicking a turn re-cues the player instead.
- Tallies are computed from per-person votes (section 3), since Legistar's tally fields are empty.
- Untranscribed meetings show the city's machine captions, labeled as such, rather than nothing.

## 9. Still open with Tarik (not design questions)

- Confirm in the hackathon Discord that Muse Voice Transcribe counts as a Meta model for judging.
- A domain for sending email through Resend, with its DNS records added, so alerts don't land in spam.
