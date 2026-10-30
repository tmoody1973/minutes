import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DISCLOSURE, weekOf } from "../../lib/ui/shell";
import { BottomNav, Icon, TopNav } from "./_components/Nav";

// Request time, not build time: the shell is prerendered, the date streams in (cacheComponents).
async function WeekOf() {
  await connection();
  return <>Week of {weekOf(new Date())}</>;
}

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
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
          <TopNav />
          {/* Address chip: shows the saved address, district and alder once Near me stores one (Task 4.2). */}
          <div className="basis-full md:basis-auto">
            <Link
              href="/near"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 text-sm font-semibold text-ink no-underline hover:border-ink hover:text-ink"
            >
              <Icon name="pin" size={14} />
              Set your address
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-4 px-4 py-4 md:px-7 md:pb-10 md:pt-6">{children}</main>

      {/* ponytail: voice slot. Ask by voice (M8, should-tier) mounts above the bottom nav here; nothing renders until it ships. */}
      <footer className="mx-auto w-full max-w-[1360px] px-4 pb-6 md:px-7">
        <p className="max-w-[65ch] text-xs leading-relaxed text-muted">{DISCLOSURE}</p>
      </footer>

      <BottomNav />
    </div>
  );
}
