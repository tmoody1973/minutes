"""Cut one meeting WAV into <=595 s chunks and transcribe each with Muse Voice
Transcribe (DIARIZATION). Saves raw per-chunk JSON plus its offset; no stitching.

Usage: python3 transcribe_meeting.py <meeting.wav> <out_dir>
Needs META_API_KEY in the environment (source .env.local).
"""
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

CHUNK_S = 595  # API hard limit is 600 s; ffmpeg can overshoot by ~10 ms
WORKERS = 4
MAX_TRIES = 5
ENDPOINT = "https://api.meta.ai/v1/asr/transcribe"
REQUEST = json.dumps({
    "model": "muse-voice-transcribe-1.0", "mode": "DIARIZATION",
    "audioEncoding": "WAV", "languageBias": ["en"],
})


def duration_s(wav: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(wav)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def cut(wav: Path, start: int, dest: Path) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", str(start), "-t", str(CHUNK_S),
                    "-i", str(wav), "-c:a", "pcm_s16le", "-map_metadata", "-1", str(dest)], check=True)


def post(chunk: Path) -> tuple[int, dict]:
    out = subprocess.run(
        ["curl", "-sS", "-w", "\n%{http_code}", "-H", f"Authorization: Bearer {os.environ['META_API_KEY']}",
         "-F", f"request={REQUEST};type=application/json", "-F", f"audio=@{chunk};type=audio/wav", ENDPOINT],
        capture_output=True, text=True)
    body, _, code = out.stdout.rpartition("\n")
    try:
        return int(code), json.loads(body)
    except (ValueError, json.JSONDecodeError):
        return int(code or 0), {"raw": out.stdout[-500:], "stderr": out.stderr[-500:]}


def transcribe(wav: Path, out_dir: Path, index: int) -> str:
    dest = out_dir / f"chunk_{index:03d}.json"
    if dest.exists():
        return f"chunk {index}: cached"
    start = index * CHUNK_S
    chunk = out_dir / f"chunk_{index:03d}.wav"
    cut(wav, start, chunk)
    for attempt in range(MAX_TRIES):
        code, data = post(chunk)
        if code == 200 and "turns" in data:
            dest.write_text(json.dumps({"index": index, "offsetMs": start * 1000, **data}, indent=1))
            chunk.unlink()
            return f"chunk {index}: {len(data['turns'])} turns, {data.get('audioDurationMs', 0) / 1000:.0f}s"
        if code not in (429, 500, 502, 503, 504):
            return f"chunk {index}: FAILED HTTP {code} {json.dumps(data)[:300]}"
        time.sleep(2 ** attempt * 5)
    return f"chunk {index}: FAILED after {MAX_TRIES} tries (last HTTP {code})"


def main() -> None:
    wav, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    total = duration_s(wav)
    n = int(total // CHUNK_S) + (1 if total % CHUNK_S > 1 else 0)
    print(f"{wav.name}: {total / 3600:.2f} h → {n} chunks, est ${total / 3600 * 0.18:.2f}")
    t0 = time.time()
    with ThreadPoolExecutor(WORKERS) as pool:
        for line in pool.map(lambda i: transcribe(wav, out_dir, i), range(n)):
            print(" ", line, flush=True)
    done = sorted(out_dir.glob("chunk_*.json"))
    secs = sum(json.loads(p.read_text()).get("audioDurationMs", 0) for p in done) / 1000
    print(f"{len(done)}/{n} chunks saved, {secs / 3600:.2f} h billed ≈ ${secs / 3600 * 0.18:.3f}, {time.time() - t0:.0f}s wall")


if __name__ == "__main__":
    main()
