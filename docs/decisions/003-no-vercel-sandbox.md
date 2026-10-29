# 003: Don't use Vercel Sandbox for the media work

**Date:** 2026-10-29

**Decision:** Media processing runs on Tarik's Mac for the hackathon, with the Hetzner server as the place for anything long-running later. Vercel Sandbox is not used.

**Why this came up:** Tarik asked whether Vercel Sandbox (temporary Linux machines Vercel starts on demand, billed by active CPU and memory, capped at 45 minutes per session on Hobby and 24 hours on Pro) should run some of the pipeline.

**Options:**
1. **Vercel Sandbox.** No server to look after. Cost: a fourth place to deploy and debug in a six-day build, and it can't fix the one awkward step (the browser-only download, see 001).
2. **Hetzner server.** Already paid for, no time limit. Cost: Tarik maintains it.
3. **Tarik's Mac.** Already doing the work. Cost: only runs when someone starts it.

**What we chose and why:** Option 3 now, option 2 later; Claude's recommendation, accepted by Tarik. In Phase 1 the heavy lifting wasn't on our side: converting 3.5 hours of video to audio took seconds, and transcription runs on Meta's servers while our script waits. Scheduled Legistar syncing is small JSON calls that Convex's scheduled jobs handle.

**What we gave up:** If video access becomes scriptable after the hackathon, we'll need a machine that runs unattended; Sandbox would have meant not maintaining one.

**How we'll know if this was right:** No pipeline step during the hackathon is blocked by running locally.

**What actually happened:**
