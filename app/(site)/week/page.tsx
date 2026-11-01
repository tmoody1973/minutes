import type { Metadata } from "next";
import { Suspense } from "react";
import { PageIntro } from "../_components/PageIntro";
import { WeekNow } from "../_components/WeekNow";

export const metadata: Metadata = { title: "This week" };

export default function ThisWeekPage() {
  return (
    <>
      <PageIntro title="This week at City Hall">Zoning and development hearings coming up, and what was decided, from the city&apos;s records.</PageIntro>
      <Suspense fallback={<p className="text-[15px] text-muted">Loading this week…</p>}>
        <WeekNow />
      </Suspense>
    </>
  );
}
