import type { Metadata } from "next";
import { PageIntro } from "../_components/PageIntro";
import { MeetingList } from "./MeetingList";

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  return (
    <>
      <PageIntro title="Meetings">Plan Commission, committee and Council meetings, split into chapters you can jump to.</PageIntro>
      <MeetingList />
    </>
  );
}
