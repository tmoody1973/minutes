#!/usr/bin/env bash
# Phase 1 check 4: send one WAV (mono 16-bit PCM, 16/24 kHz, <=10 min, <=32 MB)
# to Muse Voice Transcribe's file endpoint in DIARIZATION mode.
# Usage: scripts/phase1/transcribe.sh <file.wav> <out.json>
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ../../.env.local; set +a

wav="$1"; out="$2"
curl -sS -w "HTTP %{http_code} in %{time_total}s\n" -o "$out" \
  -H "Authorization: Bearer $META_API_KEY" \
  -F 'request={"model":"muse-voice-transcribe-1.0","mode":"DIARIZATION","audioEncoding":"WAV","languageBias":["en"]};type=application/json' \
  -F "audio=@${wav};type=audio/wav" \
  https://api.meta.ai/v1/asr/transcribe

python3 - "$out" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1]))
if "turns" not in d:
    sys.exit(f"no turns: {json.dumps(d)[:500]}")
secs = d.get("audioDurationMs", 0) / 1000
print(f"session {d.get('sessionId')} | audio {secs:.1f}s | est cost ${secs / 3600 * 0.18:.5f} | {len(d['turns'])} turns")
for t in d["turns"]:
    print(f"  [{t['startMs']:>7}-{t['endMs']:>7} ms] {t.get('speaker', '?')}: {t['transcript']}")
EOF
