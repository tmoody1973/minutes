"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV, type NavIcon } from "../../../lib/ui/shell";

// Icon paths copied from MinPhoneHome.dc.html; one stroke weight throughout.
const ICONS: Record<NavIcon, React.ReactNode> = {
  week: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 22s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="M10 9l5 2.5-5 2.5z" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
};

export function Icon({ name, size = 22 }: { name: NavIcon; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// Laptop header nav (MinLaptopTracker): current item gets the blue underline bar.
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:flex md:flex-wrap md:gap-0.5">
      {NAV.map(({ href, label }) => {
        const current = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-11 items-center px-3.5 text-[15px] no-underline hover:text-link ${
              current ? "font-bold text-link shadow-[inset_0_-3px_0_var(--color-link)]" : "font-semibold text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Phone bottom nav (MinPhoneHome): fixed, four equal tabs, icon over label.
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV.map(({ href, label, icon }) => {
        const current = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`flex h-16 flex-1 flex-col items-center justify-center gap-[3px] text-[11px] no-underline ${
              current ? "font-bold text-link" : "font-semibold text-ink"
            }`}
          >
            <Icon name={icon} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
