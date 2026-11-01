// App shell data shared by the phone bottom nav and the laptop header (mockups MinPhoneHome, MinLaptopTracker).

// Spec decision "Disclosure": verbatim on every project and meeting screen, the About page and the README.
export const DISCLOSURE = "Built by Tarik Moody, a sitting member of the City Plan Commission. Public records only, no recommendations.";

export type NavIcon = "week" | "pin" | "video" | "bookmark";

// One label set on every width (Tarik, 2026-10-29); order follows the phone mockup.
export const NAV: readonly { href: string; label: string; icon: NavIcon }[] = [
  { href: "/week", label: "This week", icon: "week" },
  { href: "/near", label: "Near me", icon: "pin" },
  { href: "/meetings", label: "Meetings", icon: "video" },
  { href: "/following", label: "Following", icon: "bookmark" },
];

// "/" is current only on the home page; other tabs stay current on their child pages (/meetings/123).
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
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
