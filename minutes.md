# Minutes

**Milwaukee City Hall, in minutes.**

Entry for the Meta Global AI Developer Hackathon · Indie developer track · Theme: Build for Your World
Builder: Tarik Moody, member of the Milwaukee City Plan Commission · Built in parallel with Then & There
Submissions due **Wednesday, Nov 4, 2026, 9:00 PM ET (8:00 PM Central)**

---

## 1. The idea in one paragraph

Milwaukee's city government publishes almost everything: agendas, files, votes, staff reports and hours of meeting video. Almost nobody can use it. Records are scattered across files and bodies, meetings run for hours, and nothing tells you which decisions touch your block. Minutes turns Milwaukee's Legistar records and meeting audio into something anyone can follow at the depth they choose: 30 seconds on what changed for you this week, 3 minutes on a meeting told as chapters, or the full record with the transcript, votes, documents and video moment. Its hero feature is a development tracker that follows a building or zoning proposal from City Plan Commission to committee to Common Council, tied to your address. Persistent agents watch the records for you and speak up only when something near you is scheduled or decided.

## 2. Why this fits the hackathon

**Theme: Build for Your World.** "Bring Meta's models into your domain. Solve a problem you know firsthand, free up time and mental space, and make something possible that wasn't before."

- **A problem I know firsthand.** I sit on Milwaukee's City Plan Commission and work in civic media at Radio Milwaukee. I see every week how hard it is for residents to know what's proposed near them, when it's heard, and how to be heard.
- **Time and mental space freed.** No more watching a three-hour meeting for one agenda item, or checking several committee calendars to follow one project.
- **Something possible that wasn't before.** Speaker-labeled transcripts of every meeting, chaptered by agenda item and linked to the files, votes and video moment, at a cost of about 18 cents per hour of audio.

**Track: Indie developer.** Judged on creativity, technical ambition, and whether it works.

## 3. Disclosure and neutrality

I'm a sitting member of the City Plan Commission, and the commission is a core part of this demo, not left out. Neutrality comes from how the product is built and disclosed:

- **Disclosed everywhere.** The About page, the footer of every project and meeting screen, the README and the opening of the demo video say it plainly: built by a sitting Plan Commission member, presenting public records without recommendations.
- **Records, not opinions.** The Editor agent rejects any sentence that characterizes an item as good or bad, or that isn't backed by a transcript turn, vote or document.
- **Same treatment for everyone.** My statements and votes appear exactly like every other commissioner's.
- **Every side of testimony.** Public speakers' positions are listed as stated, for and against, in the order they spoke.
- **My own conduct.** I won't use the tool to comment on items pending before the commission, and I'll do a quick check with the City's ethics resources.

## 4. Who it's for

| User | What they get |
|---|---|
| Residents | What's proposed near them, when it's heard, how to comment, in plain words |
| Neighborhood groups and nonprofits | Watchlists by topic and area, hearing dates, testimony deadlines |
| Journalists | Readable meetings, timestamped quotes, a daily tip sheet of newsworthy moments |
| Students and teachers | Real files to follow through the process (roadmap) |

## 5. Features

### 5.1 Development tracker (hero, must ship)

- **Development near you.** Enter an address and see a map and list of active zoning and development files nearby, filtered by upcoming hearings, decided, or all.
- **A project's journey.** Each file shows its full path on one timeline: introduced at Common Council, City Plan Commission hearing, Zoning, Neighborhoods & Development committee hearing, Common Council vote, Mayor. Each step has its date, outcome, vote and a link to the video moment. The timeline comes from Legistar's matter histories, not model guesses.
- **What would change.** Zoned now versus proposed, with plain-language explanations of terms like Detailed Planned Development, conditional use and variance, and the official definition one tap away.
- **Where exactly.** SAM 3.1 isolates the outlined parcel on the exhibit map in the file's attachments, so the card shows precisely which lot is affected.
- **How to be heard.** Next hearing date, how to submit written or spoken comment, add to calendar. Nothing is submitted on anyone's behalf.

### 5.2 Readable meetings (must ship)

- Voice Transcribe turns meeting audio into speaker-labeled turns.
- Muse Spark matches speaker labels to names using Legistar's roll call, agenda and in-meeting cues ("the chair recognizes…"). Unconfirmed speakers stay "Speaker B."
- Turns are aligned to agenda items to make chapters. Each chapter breaks into staff presentation, applicant, public testimony, discussion and vote, with timestamps.
- Every chapter links to its file, staff report, exhibit and vote.

### 5.3 This week at City Hall + your agent (must ship)

- A weekly digest of at most five cards: what's near you, what your alderperson did, what was decided, what's coming up.
- A persistent agent watches Legistar for your address, alderperson, followed files and topics. It's quiet by default and alerts you only when something you follow is scheduled for a hearing or decided.
- Its activity log and watch list are visible and editable.

### 5.4 Ask by voice (should ship)

Tap the mic and ask in English or Spanish ("What's happening with the empty lot on [street]?"). Live Voice Transcribe captures the question; Muse Spark answers with cards (a file, a chapter, a vote), each with its source.

### 5.5 Newsroom desk (should ship)

A daily tip sheet of newsworthy moments: close votes, items held or sent back, amendments, unusually long debate, heavy public testimony. Each item has timestamped quotes for checking. Plus search across all transcripts for who said what.

### 5.6 Roadmap

- Slides captured from meeting video with SAM 3.1 and attached to the chapter where they were shown
- Organization watchlists and exports
- A classroom unit that follows a real file through the process
- Public comment practice: a 2-minute timer that transcribes a draft so you can tighten it
- Shareable "This week at City Hall" cards made with Muse Image, labeled as generated

## 6. Architecture

Deterministic pipelines first, agents on top. Every sentence a user sees points back to a stored record.

```
           ┌──────────────────── Agents (Muse Spark / Muse Wonder via Meta Model API) ────────────────────┐
           │  Watcher (persistent)   Clerk (explainer)   Speaker Matcher   Chapterer   Reporter   Editor  │
           └──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                          │ shared tools: search · get file · get chapter · cite
┌────────────────────────────── Deterministic pipelines ─┴─────────────────────────────────────────────────┐
│ Legistar sync: events · agenda items · matters · histories · votes · roll calls · attachments · people     │
│ Media: meeting video → audio → 16 kHz mono WAV → chunks → Voice Transcribe → speaker-labeled turns         │
│ Documents: attachments → Muse Spark reading (staff reports, fiscal notes) · exhibit maps → SAM 3.1         │
│ Geography: address → geocode → aldermanic district, parcel, distance to each file                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                          │
                          Web app (phone + laptop): This week · Development · Meetings · Files · Ask
```

### 6.1 Pipelines

1. **Legistar sync.** On a schedule, pull bodies, events, event items, matters, matter histories, votes, roll calls, attachments and people. Store everything locally; the app never calls Legistar live for a user.
2. **Project linking.** Connect a file's history across City Plan Commission, the ZND committee and Common Council using matter IDs and histories, so one project has one timeline.
3. **Media.** Find each meeting's video or audio link, extract audio, convert to 16 kHz mono 16-bit WAV, split into chunks that fit the API's limits, transcribe with speaker labels, then stitch the turns back together with corrected timestamps.
4. **Speaker naming.** Match speaker labels to names using roll calls, the agenda and cues in the transcript. Labels are only valid within one session, so speakers are re-matched across chunks. Low confidence stays unnamed.
5. **Chaptering.** Align turns to agenda items using the agenda order and transitions in the transcript ("next item," file numbers read aloud). Split each item into presentation, applicant, testimony, discussion, vote.
6. **Documents.** Muse Spark reads staff reports and fiscal notes to extract what's proposed, the zoning change and key numbers, each tied to a page. SAM 3.1 isolates the outlined parcel on exhibit maps.
7. **Geography.** Geocode addresses, assign aldermanic districts from the city's GIS layers, match files to parcels and compute what's "near you."

### 6.2 Agents

| Agent | Job |
|---|---|
| **Watcher** (persistent, one per user) | Watches for new or changed files, hearings and decisions that match your address, alder, follows and topics; sends at most one alert per real change |
| **Clerk** | Writes plain-language cards for files and chapters from stored records only |
| **Speaker Matcher** | Names speakers from roll calls and transcript cues; leaves low-confidence labels unnamed |
| **Chapterer** | Aligns transcript turns to agenda items and sub-parts |
| **Reporter** | Flags newsworthy moments for the newsroom desk |
| **Editor** | Never sees the drafting. Checks every sentence against its source and rejects anything unsupported or evaluative |

### 6.3 Meta models and why each is used

| Model | Use |
|---|---|
| **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) | Meeting transcripts with speaker labels; live voice questions in English and Spanish |
| **Muse Spark** | Agents, speaker naming, chaptering, reading long staff reports (1M-token context) |
| **Muse Wonder** | The Editor, if it proves stronger at verification; test before committing |
| **SAM 3.1** | Isolating parcels on zoning exhibit maps; slide capture from video (roadmap) |
| **Muse Image** | Shareable weekly cards, labeled as generated (roadmap) |
| **Meta open-weights model** | Cheap, high-volume topic tagging of agenda items |
| **Muse Code** | The coding agent used to build the project; document this in the README |

Voice Transcribe is on the Meta Model API but isn't in the hackathon page's model list. Confirm in the Discord that it counts.

## 7. Data sources and limits

**Legistar Web API** (base `https://webapi.legistar.com/v1/milwaukee`, verify with one call)

- **Events:** body, date, agenda and minutes files, `EventVideoPath`, `EventMedia`, `EventInSiteURL`
- **Event items:** agenda order, action, passed flag, mover and seconder, linked matter, `EventItemVideo`, `EventItemVideoIndex`
- **Matters:** file number, title, type, status, body, dates; plus `MatterHistories`, `MatterAttachments`, `MatterText`, `MatterSponsors`
- **Votes and attendance:** `EventVotes`, `EventRollCalls`
- **People and seats:** `Persons`, `OfficeRecords`

**Muse Voice Transcribe** (verify against Meta's docs)

- $0.18 per hour of audio ($3.00 per 1,000 minutes)
- Speaker labels for 20+ speakers; labels are scoped to one session
- Turn-level timestamps in milliseconds; no word-level timestamps
- Live sessions over WebSocket up to 60 minutes; uploaded files must be mono 16-bit PCM WAV at 16 or 24 kHz, up to 32 MB and 10 minutes per request
- One integration guide describes it as realtime-only, so test the file endpoint first; if it isn't available, stream recorded audio through the live endpoint in 60-minute sessions

**Other**

- City of Milwaukee GIS layers for aldermanic districts and parcels; MPROP for property records
- A geocoder (for example, the free U.S. Census Geocoder) for addresses

## 8. Data model (first pass)

- **bodies:** id, name (City Plan Commission, ZND committee, Common Council…)
- **events:** id, body, date, video URL, agenda and minutes URLs, transcription status
- **event_items:** id, event, order, matter id, action, passed, video index
- **matters:** id, file number, title, type, status, location, parcel ids, plain-language summary, zoning from and to
- **matter_steps:** matter id, body, date, action, vote tally, event item id (the project timeline)
- **votes / roll_calls:** event item or event, person, value
- **persons:** id, name, role, seat
- **turns:** event id, start ms, end ms, speaker label, matched person id, confidence, text
- **chapters:** event item id, start ms, end ms, sub-parts, summary, sources
- **users / watcher memory:** address, district, follows, topics, alerts sent, activity log

## 9. UX principles

- **Three depths everywhere:** 30 seconds, 3 minutes, the full record.
- **One decision per card.** Plain words first; official text one tap away.
- **Nothing without a source chip.** File, staff report, exhibit, vote, video moment.
- **Quiet by default.** Alerts only for hearings and decisions on things you follow.
- **Phone:** This week, Near me, Meetings, Following, plus a voice button always within reach.
- **Laptop:** list, map and detail side by side for development; chapters, video with transcript, and decision with sources side by side for meetings.
- **Accessible:** real buttons and links, 44px touch targets, strong contrast, captions from the transcript.

Mockups: the "Minutes" page of the design canvas has the phone project tracker, laptop development map, phone and laptop readable meetings, and the phone weekly view.

## 10. How we'll show it works

- **Coverage:** number of meetings and hours transcribed, files linked across bodies.
- **Speaker naming:** share of turns named, and accuracy on a hand-checked sample.
- **Chapter alignment:** share of agenda items correctly located, checked against the video.
- **Editor rejection rate:** with an example of a rejected sentence and why.
- **Cost:** dollars per meeting hour, end to end.

## 11. Build plan (Oct 29 – Nov 4, alongside Then & There)

| Day | Minutes goal | Done when |
|---|---|---|
| **Thu Oct 29** | Verify the inputs | Legistar API answers for Milwaukee; City Plan Commission, ZND and Council found as bodies; meeting audio links found and downloadable; Voice Transcribe works on one chunk; sync started |
| **Fri Oct 30** | Transcripts | 3–4 recent meetings (including one Plan Commission) transcribed, stitched and speaker-named |
| **Sat Oct 31** | Development data | Files linked across bodies into project timelines; addresses geocoded; parcels isolated on exhibit maps |
| **Sun Nov 1** | Tracker + meeting UI | Development tracker and readable meeting working end to end. **Checkpoint:** decide which project gets the final polish |
| **Mon Nov 2** | Weekly view + Watcher | This week at City Hall and one real alert; Ask by voice if time allows |
| **Tue Nov 3** | Measure + polish | Metrics, Editor checks, mobile and laptop polish, disclosure on every screen |
| **Wed Nov 4** | Ship | Demo video, README, submission in by mid-afternoon Central |

**Cut order if behind:** newsroom desk, then Ask by voice, then the map (keep the list). The development tracker and one readable Plan Commission meeting don't get cut.

## 12. Demo script (about 3 minutes)

1. **Disclosure and hook (20 s).** "I sit on Milwaukee's City Plan Commission, and even I need this. Minutes shows public records, never recommendations."
2. **Near you (40 s).** Enter an address; the map shows proposals nearby; open one.
3. **The journey (40 s).** Its timeline from Council to Plan Commission to committee; the parcel outlined from the exhibit map; what would change, in plain words.
4. **The meeting (50 s).** Tap the Plan Commission step; the meeting in chapters; jump straight to public testimony on this item, names and all.
5. **Stay in the loop (20 s).** Follow the project; the weekly view; the next hearing and how to comment.
6. **Close (10 s).** Every meeting, every file, in minutes.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Meeting audio can't be downloaded or isn't linked | Check day one; fall back to the public City Channel recordings, or demo with fewer meetings |
| Voice Transcribe file endpoint unavailable | Stream recorded audio through the live endpoint |
| Speaker naming errors | Show unconfirmed speakers as "Speaker B"; never guess |
| Plan Commission records aren't in Legistar, or files don't link across bodies | Check day one; link by file number and address as a fallback |
| Perceived bias from a sitting commissioner | Disclosure on every screen, Editor neutrality rules, same treatment for all members |
| Two projects in one week | Shared components; Sunday checkpoint decides the final polish |

## 14. Submission checklist

- [ ] Official Rules checked: multiple submissions, pre-existing work, required materials
- [ ] Voice Transcribe confirmed as allowed
- [ ] Working app URL
- [ ] Public repo with README: what it does, how each Meta model is used, what was built during the hackathon, built with Muse Code, disclosure
- [ ] Demo video
- [ ] Measured results
- [ ] Submitted before Nov 4, 9:00 PM ET

## 15. Open questions

- Are City Plan Commission meetings and files in Milwaukee's Legistar, and is their video or audio linked there?
- How do zoning files connect across Plan Commission, ZND and Council in the matter histories?
- Final name: Minutes (current), Second, The Gallery, Floor Notes
- Which recent Plan Commission item makes the best demo, given the disclosure rules

## Sources

- [Meta Global AI Developer Hackathon (Cerebral Valley)](https://cerebralvalley.ai/e/meta-ai-developer-hackathon.md)
- [Muse Voice Transcribe: API details (OrcaRouter)](https://www.orcarouter.ai/blog/muse-voice-transcribe)
- [Meta launches Muse Voice Transcribe (DataNorth)](https://datanorth.ai/news/meta-launches-muse-voice-transcribe)
- [Meta provider docs (LiteLLM)](https://docs.litellm.ai/docs/providers/meta.md)
- [Legistar API object types (Go package docs)](https://pkg.go.dev/github.com/jehiah/legislator/legistar)
- [Districtry issue referencing Milwaukee's Legistar API](https://github.com/ThursdaysFamous/districtry/issues/652)
- [How We Designed Muse (Meta)](https://introducing.muse.ai/)
