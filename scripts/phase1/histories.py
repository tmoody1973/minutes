"""Phase 1 check 3: agenda items for one event, then MatterHistories for zoning files on it.

Answers: does one MatterId carry the CPC, ZND and Council steps?
"""
import json
import sys
import urllib.request

BASE = "https://webapi.legistar.com/v1/milwaukee"
TRACKED = {"CITY PLAN COMMISSION", "ZONING, NEIGHBORHOODS & DEVELOPMENT COMMITTEE", "COMMON COUNCIL"}


def get(path: str):
    with urllib.request.urlopen(f"{BASE}/{path}", timeout=30) as r:
        return json.load(r)


def main() -> None:
    if sys.argv[1] == "matter":
        for mid in sys.argv[2:]:
            print_history(int(mid))
        return
    event_id, limit = int(sys.argv[1]), int(sys.argv[2]) if len(sys.argv) > 2 else 2
    items = get(f"events/{event_id}/eventitems?AgendaNote=1&MinutesNote=1&Attachments=1")
    print(f"event {event_id}: {len(items)} items")
    for i in items:
        print(" ", i["EventItemAgendaSequence"], i.get("EventItemMatterFile"), i.get("EventItemMatterType"),
              "| action:", i.get("EventItemActionName"), "| passed:", i.get("EventItemPassedFlagName"),
              "| videoIdx:", i.get("EventItemVideoIndex"), "| video:", i.get("EventItemVideo"))
    zoning = [i for i in items if i.get("EventItemMatterId") and "zon" in (i.get("EventItemTitle") or "").lower()]
    for i in zoning[:limit]:
        print_history(i["EventItemMatterId"], i["EventItemMatterFile"], i["EventItemTitle"])


def print_history(mid: int, file_no: str = "", title: str = "") -> None:
    hist = get(f"matters/{mid}/histories")
    bodies = {h["MatterHistoryActionBodyName"] for h in hist}
    print(f"\nMATTER {mid} file {file_no}: {title[:140]}")
    for h in sorted(hist, key=lambda h: h["MatterHistoryActionDate"]):
        print("  ", h["MatterHistoryActionDate"][:10], "|", h["MatterHistoryActionBodyName"], "|",
              h.get("MatterHistoryActionName"), "| passed:", h.get("MatterHistoryPassedFlagName"),
              "| tally:", h.get("MatterHistoryTally"), "| eventId:", h.get("MatterHistoryEventId"))
    print("  bodies on this one matter:", sorted(bodies & TRACKED), "| all 3:", TRACKED <= bodies)

if __name__ == "__main__":
    main()
