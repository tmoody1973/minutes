# 001: Get meeting audio through the city's own Download button, in a browser

**Date:** 2026-10-29

**Decision:** For the hackathon, meeting video is downloaded by driving a real browser through the Download button on the city's Granicus video player, then the audio is pulled out and the video deleted.

**Why this came up:** Legistar doesn't hold meeting video itself. It points to Granicus, the city's video host. Granicus offers a public "Video Download" button, but its delivery network refuses the same file when a script asks for it (an HTTP 403 "forbidden" error). Without audio there are no transcripts, and readable meetings are a must-ship feature.

**Options:**
1. **Browser download.** Use a real browser to press the same button a resident would. Works today. Cost: someone has to start it; it is not a hands-off scheduled job, and each meeting is a ~3 GB download.
2. **Disguise the script as a browser.** The earlier gavel-slack-agent project did this by sending a fake browser ID (a "user agent," the label a program sends to say what it is). Works and could run unattended. Cost: it deliberately gets around a filter the host put up, which sits badly next to a product whose whole pitch is neutral, above-board use of public records.
3. **Use the city's free machine captions instead.** No download needed. Cost: rough text, no speaker labels, and it skips the Meta model that powers the core feature.
4. **Ask the City Clerk or Granicus for proper access.** The right long-term answer. Cost: won't happen by Nov 4.

**What we chose and why:** Option 1, made by Tarik on Claude's recommendation. The demo needs three or four meetings, not a firehose, so a started-by-hand download is enough, and it keeps the project clearly on the right side of the host's rules. Captions remain a free fallback for meetings we don't transcribe, labeled as such.

**What we gave up:** New meetings don't flow in on their own. After the hackathon, Minutes can't claim "every meeting, automatically" until option 4 happens.

**How we'll know if this was right:** All demo meetings (Plan Commission Sep 28, ZND Oct 6, Council Oct 13) are downloaded and transcribed before the Nov 1 checkpoint without any workaround. (Done Oct 29: 6.34 hours, 40 chunks, no failures, $1.14.)

**What actually happened:**
