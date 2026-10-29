# Kickoff prompt for Claude Code: Minutes

Before pasting, make sure both plugins are installed in Claude Code:

- **Superpowers** (obra/superpowers): `/plugin marketplace add obra/superpowers-marketplace`, then `/plugin install superpowers@superpowers-marketplace`
- **Impeccable** (pbakaus/impeccable)

Then paste everything below the line into Claude Code at the root of a new repo that contains `minutes.md` and the `mockups/` folder.

---

You're helping me build **Minutes** ("Milwaukee City Hall, in minutes") for the Meta Global AI Developer Hackathon, Indie developer track. Submissions are due **Wednesday, Nov 4, 2026, 9:00 PM ET**. I'm building a second project in parallel, so time is tight and scope discipline matters more than features.

**Work through the Superpowers skills for process and the Impeccable skill for all UI.** The phases below say which skill to use when. Don't skip a phase without telling me why.

## Read first

1. `minutes.md` is the build brief and the source of truth for scope, architecture, agents, data sources, neutrality rules, the day-by-day plan (section 11) and the cut order.
2. `mockups/` holds five screens: phone project tracker, laptop development map, phone and laptop readable meeting, phone weekly view. They are **design references, not code to copy**. They're in a canvas format: `{{name}}` holes, `<sc-for>` loops, `<sc-if>` branches, and a small logic class at the bottom holding sample state. Read them for layout, hierarchy, copy, color, type and interactions, then rebuild them as real components.
3. Bracketed text (`[Street address]`, `[Nov 10]`, `[vote]`) is placeholder. **Never invent real-looking Milwaukee data.** Real addresses, file numbers, names, dates and votes come only from Legistar or the transcripts.

## Phase 1: Verify the inputs (Superpowers: `systematic-debugging`, `verification-before-completion`)

Before any app code, write small scripts, run them, and report results to me. Don't claim something works without showing the output.

1. **Legistar:** call `https://webapi.legistar.com/v1/milwaukee/bodies`. Confirm it responds; find the City Plan Commission, the Zoning, Neighborhoods & Development committee and the Common Council.
2. **Events and media:** pull the last month of events for those bodies. Report which have `EventVideoPath`, `EventMedia` or an InSite link, and whether the audio or video can actually be downloaded.
3. **Project linking:** pull `MatterHistories` for two recent zoning files. Report whether one matter connects the Plan Commission, ZND and Council steps.
4. **Voice Transcribe:** convert a 10-minute clip to 16 kHz mono 16-bit WAV and send it to `muse-voice-transcribe-1.0` on the Meta Model API with speaker labels. Try the file endpoint first, then the live WebSocket. Report labels, timestamps and cost.
5. **SAM 3.1:** run it on one zoning exhibit map with a short prompt like "outlined parcel." Report whether it isolates the parcel.

Keys go in environment variables (`META_API_KEY`). Confirm model IDs and endpoints against Meta's docs.

**Stop and report.** I'll confirm what to keep, cut or change before Phase 2.

## Phase 2: Fill the gaps (Superpowers: `brainstorming`)

Use `brainstorming` only on what the brief and Phase 1 left open (for example, how to link files if histories don't connect, or where audio comes from if it isn't in Legistar). Ask me one question at a time. Don't re-brainstorm decisions the brief already makes.

## Phase 3: Plan (Superpowers: `writing-plans`)

Use `writing-plans` to turn the brief's section 11 and the Phase 1 findings into a plan with small, verifiable tasks, grouped into these milestones in this order:

1. Legistar sync + local store
2. Project timelines (files linked across bodies)
3. Media pipeline: audio → chunks → transcripts → speaker naming → chapters
4. Development tracker UI (phone + laptop)
5. Readable meeting UI (phone + laptop)
6. This week view + the Watcher agent
7. Editor agent checks on all generated text
8. Should-haves only if on schedule: Ask by voice, newsroom desk

Mark each task's tier (must / should / roadmap) and keep the brief's cut order. Show me the plan before executing.

## Phase 4: Design setup (Impeccable: `init`, then `shape`)

- Run Impeccable's **`init`** to create `PRODUCT.md` from the brief. Include: audience (residents, neighborhood groups, journalists, students), purpose, the three-depths principle, quiet-by-default alerts, and the neutrality and disclosure rules as hard design constraints.
- Create `DESIGN.md` from the mockups: navy `#10203A` ink, blue `#1F56C2` accent, amber `#8A4B00` on `#FDF1DC` for upcoming hearings, `#F7F7F4` ground, `#5B6577` secondary text, `#DCDFE5` borders; Public Sans for UI, IBM Plex Mono for file numbers, timestamps and labels; 12–14px radii; 44px minimum touch targets.
- Before building each screen, run Impeccable's **`shape`** on it, using the matching mockup as the reference.

## Phase 5: Build (Superpowers: `using-git-worktrees`, `subagent-driven-development`, `test-driven-development`)

- One branch or worktree per milestone (`using-git-worktrees`).
- Execute the plan with `subagent-driven-development`. Use `dispatching-parallel-agents` only for truly independent pieces, like the Legistar sync and the audio conversion.
- Use **`test-driven-development` for the pipelines**, where bugs are silent: Legistar parsing, linking files across bodies, chunk stitching and timestamp offsets, speaker re-matching across chunks, chapter alignment, and the Editor's cite-or-reject rule.
- Use **Impeccable for every screen**, matching the mockups on phone and laptop.
- Use `systematic-debugging` whenever something fails. Don't guess-and-patch.

## Phase 6: Review each milestone (Impeccable: `critique`, `audit`, then `adapt`, `harden`, `polish`; Superpowers: `requesting-code-review`, `verification-before-completion`, `finishing-a-development-branch`)

For every UI milestone:

1. Run Impeccable **`critique`** and **`audit`** once, covering both phone and laptop widths.
2. Fix everything they find in one batch, using **`adapt`** for phone/laptop layout issues and **`harden`** for loading, empty and error states (no transcript yet, no files near you, Legistar down).
3. One confirmation round at most, then **`polish`**.

For every milestone:

1. `requesting-code-review` on the changes; respond with `receiving-code-review`.
2. `verification-before-completion`: show it working with real data before calling it done.
3. `finishing-a-development-branch` to merge.
4. Add a line to `DEVLOG.md`: date, what was built, what was verified. The hackathon needs proof of what was built during the event.

## Non-negotiables

- **Disclosure** on the About page, the footer of every project and meeting screen, and the README: built by a sitting City Plan Commission member; public records only, no recommendations.
- **Neutrality:** the Editor rejects any sentence that judges an item or isn't backed by a transcript turn, vote or document. Every commissioner, including me, is shown the same way.
- **No guessed speakers:** unconfirmed speakers stay "Speaker B."
- **Nothing submitted on a user's behalf** (comments, testimony).
- **Phone and laptop both finished and accessible:** real buttons and links, 44px touch targets, strong contrast.
- **Deterministic first, agents on top:** every sentence a user sees traces to a stored record.

## Stack (suggested; ask me before changing)

Next.js on Vercel, Convex for data and scheduled jobs, Clerk for sign-in. Heavy media work (audio download, conversion, chunking) can run as a worker on my Hetzner VPS if Vercel's limits get in the way.

**Start with Phase 1 and report back before writing app code.**
