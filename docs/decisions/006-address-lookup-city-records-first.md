# 006: Near me looks up a typed address in city property records first, and the Census geocoder only as a fallback

**Date:** 2026-10-29

**Decision:** When a resident types an address on Near me, Minutes first reads it as a street address and looks it up in the city's own property records (MPROP, the city's master list of every lot, plus its parcel map). Only if that fails does it ask the U.S. Census geocoder (a free federal service that turns an address into map coordinates).

**Why this came up:** Near me is the feature the demo opens on: type your address, see what is proposed near you. It was built on the Census geocoder alone. On the night it was built, Census failed most of the time: in five identical requests, three returned a server error after about 10 seconds, and the two successes took 0.4 and 10 seconds. It also found nothing at all for a street-only address like "711 E Kilbourn Ave" unless the city and state were added. If that happens during the demo, the feature looks broken. The same three lookups through city records took 0.2 to 0.9 seconds, every time.

**Options:**
1. **Keep Census only.** No work. Cost: a dead feature whenever Census has a bad night, and a 10-second wait before the error shows.
2. **Retry Census once.** About 15 minutes. Cost: still failed about one time in three that night, and a failure could take 20 seconds to show.
3. **City records first, Census as fallback.** One to two hours, mostly a parser that reads what residents type ("711 E Kilbourn Ave", "711 East Kilbourn Avenue, Milwaukee WI 53202"). Cost: more code, and two city services in the path instead of one federal one.

**What we chose and why:** Option 3. Claude recommended it; Tarik made the call. It uses the same city records the project already trusts for lot outlines (decision 002), so a typed address and a project are located the same way. It also returns the alder district for free, which the header now shows ("711 E Kilbourn Ave · District 4"). Census still covers anything the parser can't read or the city records don't hold.

**What we gave up:**
- An address must name a direction (E, North...) to use city records; "711 Kilbourn Ave" goes to Census and can still fail on a bad night.
- An address that is not its own lot in MPROP (an apartment unit, a number inside a shared range on the other side of the street) falls back to Census.
- The typed address now goes to two city services (data.milwaukee.gov and milwaukeemaps.milwaukee.gov) instead of one federal one. It is still never stored by Minutes or logged.

**How we'll know if this was right:** Before the demo, type ten real Milwaukee addresses, half of them near Bookends or Southgate. All ten should resolve in under 3 seconds, and any that fall back to Census should be ones without a direction or not on a lot of their own.

**What actually happened:**
