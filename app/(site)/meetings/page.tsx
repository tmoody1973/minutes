import type { Metadata } from "next";
import { PageIntro } from "../_components/PageIntro";

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  return <PageIntro title="Meetings">Readable meetings, with chapters, quotes and votes, are coming soon.</PageIntro>;
}
