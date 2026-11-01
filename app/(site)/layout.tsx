import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DISCLOSURE, weekOf } from "../../lib/ui/shell";
import { Account } from "./_components/Account";
import { AddressChip } from "./_components/AddressChip";
import { BottomNav, CurrentBottomNav, CurrentTopNav, TopNav } from "./_components/Nav";

// Request time, not build time: the shell is prerendered, the date streams in (cacheComponents).
async function WeekOf() {
  await connection();
  return <>Week of {weekOf(new Date())}</>;
}

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <a
        href="#main"
        className="sr-only z-20 rounded-lg bg-ink px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:text-white"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-2.5 px-4 pb-3 pt-4 md:justify-between md:px-7 md:py-2.5">
          <Link href="/" className="flex items-baseline gap-2.5 py-1 text-ink no-underline">
            <span className="text-[26px] font-extrabold tracking-[-0.02em]">Minutes</span>
            <span className="hidden text-[13px] text-muted md:inline">Milwaukee City Hall, in minutes</span>
          </Link>
          <span className="ml-auto text-[13px] text-muted md:hidden">
            <Suspense>
              <WeekOf />
            </Suspense>
          </span>
          <Suspense fallback={<TopNav pathname={null} />}>
            <CurrentTopNav />
          </Suspense>
          <div className="flex basis-full items-center justify-between gap-2 md:basis-auto">
            <AddressChip />
            {/* Clerk reads the session per request: inside Suspense so the shell still prerenders (cacheComponents). */}
            <Suspense>
              <Account />
            </Suspense>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-4 px-4 py-4 md:px-7 md:pb-10 md:pt-6">{children}</main>

      {/* ponytail: voice slot. Ask by voice (M8, should-tier) mounts above the bottom nav here; nothing renders until it ships. */}
      <footer className="mx-auto w-full max-w-[1360px] px-4 pb-6 md:px-7">
        <p className="max-w-[65ch] text-xs leading-relaxed text-muted">
          {DISCLOSURE}{" "}
          <Link href="/about" className="font-semibold">
            About Minutes
          </Link>
        </p>
      </footer>

      <Suspense fallback={<BottomNav pathname={null} />}>
        <CurrentBottomNav />
      </Suspense>
    </div>
  );
}
