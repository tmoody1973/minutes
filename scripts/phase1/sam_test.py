"""Phase 1 check 5: SAM 3.1 on a zoning exhibit map. Prints boxes per prompt.

Usage: python3 sam_test.py <image.png> "prompt one" ["prompt two" ...]
Reads META_API_KEY from the environment (source .env.local first).
"""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request

URL = "https://api.meta.ai/v1/responses"
BOX_RE = re.compile(r"(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)[^|]*\|>")


def segment(image_path: str, prompt: str) -> dict:
    if image_path.startswith("https://"):
        image_url = image_path
    else:
        mime = "image/jpeg" if image_path.lower().endswith((".jpg", ".jpeg")) else "image/png"
        image_url = f"data:{mime};base64,{base64.b64encode(open(image_path, 'rb').read()).decode()}"
    body = {
        "model": "sam-3.1",
        "input": [{"role": "user", "content": [
            {"type": "input_text", "text": prompt},
            {"type": "input_image", "image_url": image_url},
        ]}],
    }
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={
        "Authorization": f"Bearer {os.environ['META_API_KEY']}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:500]}")


def output_text(resp: dict) -> str:
    return "".join(
        part.get("text", "")
        for item in resp.get("output", [])
        for part in item.get("content", []) or []
        if part.get("type") == "output_text"
    )


def main() -> None:
    image, prompts = sys.argv[1], sys.argv[2:]
    for prompt in prompts:
        resp = segment(image, prompt)
        slug = re.sub(r"\W+", "_", prompt)
        json.dump(resp, open(f"out/sam_{slug}.json", "w"), indent=1)
        text = output_text(resp)
        boxes = BOX_RE.findall(text)
        print(f'\nPROMPT "{prompt}": {len(boxes)} object(s), usage={resp.get("usage")}')
        for obj, x1, y1, x2, y2, w, h in boxes:
            print(f"  obj {obj}: box ({x1},{y1})-({x2},{y2}) in {w}x{h}")
        if not boxes:
            print("  raw:", text[:300] or json.dumps(resp)[:300])


if __name__ == "__main__":
    main()
