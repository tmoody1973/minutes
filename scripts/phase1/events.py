"""Phase 1 check 2: last month of events for CPC, ZND, Council; report media fields."""
import json
import sys
import urllib.parse
import urllib.request

BASE = "https://webapi.legistar.com/v1/milwaukee"
BODIES = {1: "Common Council", 11: "ZND", 272: "City Plan Commission"}
SINCE = sys.argv[1] if len(sys.argv) > 1 else "2026-09-29"


def get(path, params=None):
    url = f"{BASE}/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def main():
    ids = " or ".join(f"EventBodyId eq {b}" for b in BODIES)
    events = get("events", {
        "$filter": f"EventDate ge datetime'{SINCE}' and ({ids})",
        "$orderby": "EventDate desc",
    })
    json.dump(events, open(sys.argv[2] if len(sys.argv) > 2 else "events.json", "w"), indent=1)
    print(f"{len(events)} events since {SINCE}")
    for e in events:
        print(
            e["EventId"], e["EventDate"][:10], BODIES[e["EventBodyId"]],
            "| video:", e.get("EventVideoPath"),
            "| media:", e.get("EventMedia"),
            "| insite:", e.get("EventInSiteURL"),
            "| agenda:", bool(e.get("EventAgendaFile")),
            "| minutes:", bool(e.get("EventMinutesFile")),
        )


if __name__ == "__main__":
    main()
