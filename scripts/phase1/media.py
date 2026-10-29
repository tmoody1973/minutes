"""Phase 1 check 2b: resolve each event's Granicus clip to a direct MP4 and HEAD it."""
import json
import re
import sys
import urllib.request

PLAYER = "https://milwaukee.granicus.com/player/clip/{clip}?view_id=2&redirect=true"
MP4_RE = re.compile(r"https://archive-video\.granicus\.com/milwaukee/[^\"' <]+\.mp4")


def mp4_for_clip(clip: int) -> str | None:
    with urllib.request.urlopen(PLAYER.format(clip=clip), timeout=30) as r:
        m = MP4_RE.search(r.read().decode("utf-8", "replace"))
    return m.group(0) if m else None


def head(url: str) -> tuple[int, str, str]:
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.headers.get("Content-Length", "?"), r.headers.get("Accept-Ranges", "?")


def main() -> None:
    events = json.load(open(sys.argv[1]))
    for e in events:
        clip = e.get("EventMedia")
        if not clip:
            print(e["EventId"], "no EventMedia")
            continue
        url = mp4_for_clip(int(clip))
        if not url:
            print(e["EventId"], clip, "no mp4 found in player page")
            continue
        status, size, ranges = head(url)
        mb = int(size) / 1e6 if size.isdigit() else float("nan")
        print(f"{e['EventId']} {e['EventDate'][:10]} clip={clip} HTTP {status} {mb:.0f} MB ranges={ranges}\n  {url}")


if __name__ == "__main__":
    main()
