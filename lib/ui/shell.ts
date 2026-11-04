// App shell data shared by the phone bottom nav and the laptop header (mockups MinPhoneHome, MinLaptopTracker).

// Builder line on every page, the About page, alert emails and the README (Tarik, Nov 4: no commission mention).
export const DISCLOSURE = "Built by Tarik Moody. Public records only, no recommendations.";

export type NavIcon = "ask" | "week" | "pin" | "video" | "bookmark";

// One label set on every width (Tarik, 2026-10-29); order follows the phone mockup.
export const NAV: readonly { href: string; label: string; icon: NavIcon }[] = [
  // All of City Hall, Ask first (UX brief 2026-11-02). Near me moved to the header's address chip.
  { href: "/", label: "Ask", icon: "ask" },
  { href: "/week", label: "This week", icon: "week" },
  { href: "/meetings", label: "Meetings", icon: "video" },
  { href: "/following", label: "Following", icon: "bookmark" },
];

// "/" is current only on the home page; other tabs stay current on their child pages (/meetings/123).
export function isActive(pathname: string, href: string): boolean {
  // Home is the Ask tab; an answer page (/ask) keeps it current.
  if (href === "/") return pathname === "/" || pathname === "/ask";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Monday of the current Milwaukee week, e.g. "Oct 26" (weeks run Monday to Sunday).
export function weekOf(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const back = WEEKDAYS.indexOf(part("weekday"));
  const monday = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")) - back));
  return monday.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
