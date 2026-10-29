#!/usr/bin/env bash
# Download one meeting's video through a real browser (Granicus refuses plain
# scripts), extract 16 kHz mono 16-bit WAV audio, then delete the video.
# Usage: scripts/phase1/fetch_meeting.sh <eventId> <clipId> <mp4Url>
set -euo pipefail
EVENT_ID="$1" CLIP_ID="$2" MP4_URL="$3"
DATA="$(cd "$(dirname "$0")/../.." && pwd)/data/audio"
mkdir -p "$DATA"
MP4="$DATA/${EVENT_ID}.mp4"
WAV="$DATA/${EVENT_ID}.wav"

# ego-browser's runtime does not inherit shell env vars, so values are written
# into the script text. Validate them first since they become code.
[[ "$EVENT_ID" =~ ^[0-9]+$ && "$CLIP_ID" =~ ^[0-9]+$ ]] || { echo "bad event or clip id" >&2; exit 1; }
[[ "$MP4_URL" =~ ^https://archive-video\.granicus\.com/[A-Za-z0-9/_.-]+\.mp4$ ]] || { echo "bad mp4 url" >&2; exit 1; }

ego-browser nodejs <<JS
const task = await taskSpace("minutes meeting downloads");
const page = task.page("p1");
await page.goto("https://milwaukee.granicus.com/player/clip/${CLIP_ID}?view_id=2&redirect=true");
const dl = page.waitForEvent("download", { timeout: 60_000 });
await page.goto("${MP4_URL}").catch((e) => {
  if (!String(e.message).includes("ERR_ABORTED")) throw e; // ERR_ABORTED = navigation became a download
});
const d = await dl;
const t0 = Date.now();
await d.saveAs("${MP4}");
console.log("downloaded", d.suggestedFilename(), "in", Math.round((Date.now() - t0) / 1000), "s, failure:", await d.failure());
await d.delete(); // ego-browser leaves its temp copy behind otherwise (~3 GB per meeting)
JS

ffmpeg -nostdin -loglevel error -y -i "$MP4" -vn -ac 1 -ar 16000 -c:a pcm_s16le -map_metadata -1 "$WAV"
ffprobe -v error -show_entries format=duration,size -of compact "$WAV"
rm "$MP4"
echo "event $EVENT_ID audio ready: $WAV (video deleted)"
