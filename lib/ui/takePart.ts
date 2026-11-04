// How a resident takes part: each body's own comment instructions and each alder's official contact. Drafted from
// official city pages (city.milwaukee.gov and the meetings' own Legistar agendas), Nov 3, 2026, and shown only once
// Tarik approves an entry (`approved`), like the glossary and the action terms; all approved by Tarik, 2026-11-03.
// Minutes describes the city's process; it never submits anything for anyone. Pure.

export interface BeHeard {
  /** The body's label as the timeline shows it ("Fire and Police Commission"). */
  body: string;
  lines: string[];
  /** The official page the lines come from. */
  url: string;
  approved: boolean;
}

export const BE_HEARD: readonly BeHeard[] = [
  {
    body: "City Plan Commission",
    url: "https://city.milwaukee.gov/dcd/planning/cpc",
    lines: [
      "Testify in person at the meeting, or online: the commission's page explains how to register for the webinar and speak during the meeting.",
      "Or email written comments to PlanAdmin@milwaukee.gov. The agenda asks for at least one business day before the meeting; the commission's page says 24 hours.",
    ],
    approved: true,
  },
  {
    body: "Zoning, Neighborhoods & Development",
    url: "https://milwaukee.legistar1.com/milwaukee/meetings/2026/10/13446_A_ZONING%2C_NEIGHBORHOODS___DEVELOPMENT_COMMITTEE_26-10-27_Meeting_Agenda.pdf",
    lines: [
      "At a public hearing, testimony is given in person at the meeting.",
      "Or send written testimony by mail to the Office of the Common Council – City Clerk, 200 E. Wells St., Room 205, Milwaukee, WI 53202, or by email to the committee's staff assistant named on the agenda.",
    ],
    approved: true,
  },
  {
    body: "Fire and Police Commission",
    url: "https://city.milwaukee.gov/fpc/Outreach/Public-Comment-Form-",
    lines: [
      "When the agenda has a public comment item, speak in person or join online or by phone; the agenda gives the address, link and number.",
      "Or send a written comment with the commission's public comment form at least 48 hours before the meeting. Written comments may be read aloud or summarized.",
    ],
    approved: true,
  },
];

// The other Council committees publish no procedure; the Council's own page is the only official statement.
export const COUNCIL_COMMITTEES: BeHeard = {
  body: "Common Council committees",
  url: "https://city.milwaukee.gov/commoncouncil/council-members",
  lines: [
    "The city doesn't publish a public comment procedure for this committee. The Common Council's page says: “The public is allowed to participate in the discussion of matters on the agenda at committee meetings of the council.”",
    "To ask how to take part, contact the committee's staff assistant named on the agenda, or your alderperson.",
  ],
  approved: true,
};

export function beHeard(body: string, entries: readonly BeHeard[] = BE_HEARD, committees: BeHeard = COUNCIL_COMMITTEES): BeHeard | null {
  const own = entries.find((e) => e.body === body);
  if (own) return own.approved ? own : null;
  return committees.approved && / Committee$/.test(body) ? committees : null;
}

// Each district's page and the email printed on it (checked in a browser, Nov 3, 2026). Districts 1 and 2 print an
// aide's inbox, not the alder's own.
export const ALDERS: Readonly<Record<number, { page: string; email: string }>> = {
  1: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district1", email: "aide1@milwaukee.gov" },
  2: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district2", email: "aide2@milwaukee.gov" },
  3: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district3", email: "alex.brower@milwaukee.gov" },
  4: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district4", email: "rjbauma@milwaukee.gov" },
  5: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district5", email: "lamont.westmoreland@milwaukee.gov" },
  6: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district6", email: "mcoggs@milwaukee.gov" },
  7: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district7", email: "diandre.jackson@milwaukee.gov" },
  8: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district8", email: "jocasta.zamarripa@milwaukee.gov" },
  9: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district9", email: "larresa.taylor@milwaukee.gov" },
  10: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district10", email: "sharlen.moore@milwaukee.gov" },
  11: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district11", email: "peter.burgelis@milwaukee.gov" },
  12: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district12", email: "jperez@milwaukee.gov" },
  13: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district13", email: "scott.spiker@milwaukee.gov" },
  14: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district14", email: "marina@milwaukee.gov" },
  15: { page: "https://city.milwaukee.gov/commoncouncil/council-members/district15", email: "russell.stamper@milwaukee.gov" },
};
// Tarik approves the contact list per district, so one correction doesn't hold back the rest. All 15: Tarik, 2026-11-03.
export const APPROVED_ALDERS: Readonly<Record<number, boolean>> = Object.fromEntries(Object.keys(ALDERS).map((d) => [Number(d), true]));

export const alderContact = (district: number, approved: Readonly<Record<number, boolean>> = APPROVED_ALDERS) =>
  approved[district] && ALDERS[district] ? ALDERS[district] : null;
