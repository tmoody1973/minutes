import type { Metadata } from "next";
import { Suspense } from "react";
import { PageIntro } from "../_components/PageIntro";
import { MeetingList } from "./MeetingList";

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  return (
    <>
      <PageIntro title="Meetings">
        Every Common Council, committee and commission meeting this year: the agenda, what was decided and the vote counts. Some are
        split into chapters you can jump to in the video.
      </PageIntro>
      {/* The list splits coming up from past by the visitor's clock, so it renders per visit, not at build time. */}
      <Suspense fallback={<p className="text-[15px] text-muted">Loading meetings…</p>}>
        <MeetingList />
      </Suspense>
    </>
  );
}
