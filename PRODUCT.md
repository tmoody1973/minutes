# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Milwaukee residents who want to know what is proposed near them, when it is heard, and how to comment, in plain words. They arrive on a phone, often from a link or an alert, with a few minutes to spare.

Also served: neighborhood groups and nonprofits (watchlists by topic and area, hearing dates, testimony deadlines), journalists (readable meetings, timestamped quotes), and students and teachers (real files to follow through the process; roadmap). Source: `minutes.md` section 4, confirmed by Tarik 2026-10-29.

## Product Purpose

Make Milwaukee's public land-use records followable by a resident at the depth they choose. Minutes syncs the city's Legistar records, meeting video and property records, then shows each development file's path from introduction to the Mayor, each meeting as readable chapters with quotes, and a quiet weekly digest. Success: a resident can find a proposal near them, understand where it is in the process, and know how to be heard before the next hearing.

## Positioning

Every sentence traces to a stored public record (a vote, a history row, a document, a timestamped transcript turn), and an Editor rejects any sentence that characterizes an item as good or bad. It is built and openly disclosed by a sitting member of the City Plan Commission, presenting records without recommendations.

## Operating Context

Hackathon build, deadline Wed Nov 4, 2026, 9:00 PM ET. Demo follows Bookends (file 260533, a pending rezoning at 711 E. Kilbourn Ave.) and Southgate (file 260532, a completed journey). Data: Legistar web API (bodies: Common Council 1, ZND committee 11, City Plan Commission 272), Granicus meeting video, MPROP and city parcel outlines, Milwaukee Code ch. 295 for zoning definitions. Stack: Next.js 16, Tailwind 4, Convex. Design mockups: `mockups/*.dc.html` (code-first from these).

## Capabilities and Constraints

- Three depths everywhere: 30 seconds, 3 minutes, the full record.
- Near-me search covers files within half a mile of a geocoded address.
- Lot outlines come from city property records (MPROP + parcel layer), not from exhibit maps.
- Tallies are computed from per-person votes; Legistar's own tally fields are empty.
- No submit buttons: "how to be heard" links to the city's own instructions.
- Undecided: whether Ask by voice ships (should-tier, cut before the map).

## Brand Commitments

Name: Minutes. Tagline in the laptop mockup: "Milwaukee City Hall, in minutes". Disclosure line, verbatim, on every project and meeting screen, the About page and the README: "Built by Tarik Moody, a sitting member of the City Plan Commission. Public records only, no recommendations." Voice: plain, factual, no evaluative words.

## Evidence on Hand

Real synced records for files 260533 and 260532; transcripts of the Sep 28 Plan Commission, Oct 6 and Oct 27 ZND, and Oct 13 Council meetings; 21 approved zoning glossary entries (`lib/zoning/glossary-data.ts`). No testimonials, user counts or press exist; do not invent any.

## Product Principles

1. Records, not opinions: nothing appears without a source chip.
2. Same treatment for everyone: Tarik's statements and votes look exactly like every other member's.
3. Every side of testimony, as stated, in speaking order.
4. Quiet by default: alerts only for hearings and decisions on things a user follows.
5. Plain words first; official text one tap away.

## Accessibility & Inclusion

Real buttons and links, 44 px touch targets, strong contrast, captions from the transcript. English first; Spanish for Ask by voice if it ships.
