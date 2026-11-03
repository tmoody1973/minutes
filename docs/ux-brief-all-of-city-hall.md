# UX brief: Minutes for all of City Hall

Shaped 2026-11-02 with Tarik (impeccable `shape`). Decisions: Ask box first; resident on a phone is the default user, with journalist tools in place; keep the current look and rebuild the structure. Research: Gavel's Legistar reference and personas (`~/Documents/Projects/gavel-slack-agent/docs/`).

## 1. Job and audience

Anyone who wants to know what Milwaukee City Hall is doing about something they care about: a resident on a phone between other things (Denise), an organizer watching several neighborhoods (Marcos), a journalist on deadline who needs receipts (Rachel), a student following a real file. They arrive with a concern in their own words ("the budget", "police cameras", "the bar on my corner"), not a file number. Modes: landing is Persuade; Ask, This week, files and meetings are Operate and Read.

## 2. Outcome and proof

Primary action: ask a question in plain words and get an answer from the city's own records, then follow it. Success: in under a minute, someone learns what the city has done and is about to do on their concern, which body decides it next and when, and how to be heard, with every sentence one tap from its record.

Product-specific truth no generic chatbot can claim: every sentence is checked by the Editor against the records it cites, meetings are readable at the moment something was said, and a question becomes a watch that emails only when a matching item is scheduled or decided.

## 3. Selected direction

**Every question can be followed.** Ask and Follow are one object.

1. One box, top of the home page: "Ask about Milwaukee City Hall". A file number or address jumps straight to the file or Near me; anything else goes to Ask Minutes.
2. The answer page (`/ask`): the question, a short answer (2 to 5 sentences), each sentence ending in source chips (file, vote, meeting moment). Below: "The records" (files and meeting moments behind the answer, newest first), then **Follow this**.
3. Follow this: Muse Spark proposes the words to watch ("surveillance camera", "license plate reader", "Flock"); the person sees and edits them before saving. Matching follows Gavel's rule: committee or keyword in a new file title or agenda line.
4. While the agent works, show its steps in plain words ("Searching files", "Reading file 251665's history", "Checking 4 sentences"). Never a bare spinner.

Visual authority: the existing code world (Tailwind tokens, white cards, link blue, amber dots, mono kickers). No new identity.

## 4. Scope and boundaries

Production-ready: home/landing, `/ask` answer page, This week across topics, navigation, Follow a concern (in `/following`), file pages for non-zoning files, About copy.

Untouched: visual system, Near me (stays the zoning address lens), disclosure line (verbatim), Editor rules, existing zoning cards and meeting chapters.

Anti-goals: a chatbot persona or chat bubbles; opinions or recommendations (asked "should I support X?", Ask answers what the records say and how to be heard); a "choose your audience" gate; invented example questions (examples come from current records).

## 5. States and ranges

- Data: 12 bodies, about 209 meetings since Jan 1 2026, about 15 a month. A week holds 0 to 80 agenda files.
- Ask: working (steps shown), answered, partly answered (the Editor removed sentences; say "N sentences didn't pass the record check"), not in the records ("The records Minutes has don't answer this" plus the closest files and a Legistar search link), error (retry, nothing lost), signed-out Follow (sign-in, then return to the same answer).
- Votes: roll call (per member, same layout for everyone) or voice vote ("voice vote, no roll call"; never infer positions).
- Files: terse titles are common; plain summary falls back to full text, then the first attachment.
- Agenda: an item added within 48 hours of the meeting is marked "Added late".

## 6. Interaction and layout

- Phone navigation (4 tabs): Ask (home) · This week · Meetings · Following. Near me opens from the address chip in the header and from a "Near you" filter in This week.
- Topics, assigned by rule from the committee a file passes through: Budget and city money (Finance & Personnel), Public safety and health (Public Safety & Health, Fire & Police Commission), Licenses (Licenses), Streets and public works (Public Works), Development and housing (ZND, City Plan Commission, Historic Preservation), Jobs and neighborhoods (Community & Economic Development), City laws (Judiciary & Legislation), Council business (Steering & Rules). Council items take the topic of their committee step.
- This week: topic chips (horizontal scroll on a phone), cards grouped Coming up / Decided, "Added late" flag, each card linking to its file.
- File page: plain card, path through bodies, votes, sponsors, related files, "How to be heard"; Copy citation and CSV stay where they are.
- 44 px touch targets, real links and buttons, focus visible, answer text at reading size (17 px on phone).

## 7. Constraints and open decisions

- Privacy: the typed address is never stored or logged. Questions can contain addresses, so answers are not stored by default. Decided (Tarik, 2026-11-02): an answer is stored only when the person presses Share or Follow, with a note saying it will be saved and visible to anyone with the link.
- Neutrality: Tarik's votes and statements render like every member's. The disclosure line appears on home, About, file and meeting pages.
- Agent tools, mirroring Gavel's set and reading Minutes' synced copy first: search files, upcoming meetings, meeting agenda, file history, file text, votes, sponsors, meeting transcript search.
- Deadline Wed Nov 4, 8 PM Central. The phone at 390 px is checked first.
