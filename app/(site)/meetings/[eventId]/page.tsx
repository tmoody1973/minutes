import type { Metadata } from "next";
import { Suspense } from "react";
import { MeetingClient } from "./MeetingClient";

export const metadata: Metadata = { title: "Meeting" };

// MeetingClient reads the meeting id and ?item= from the URL, which cacheComponents requires inside <Suspense>.
export default function MeetingPage() {
  return (
    <Suspense fallback={<p className="text-[15px] text-muted">Loading meeting…</p>}>
      <MeetingClient />
    </Suspense>
  );
}
