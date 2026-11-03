import type { Metadata } from "next";
import { PageIntro } from "../_components/PageIntro";
import { AskClient } from "./AskClient";

export const metadata: Metadata = { title: "Ask Minutes" };

export default function AskPage() {
  return (
    <>
      <PageIntro title="Ask Minutes">
        Ask what Milwaukee City Hall is doing about something. Minutes looks it up in the city&rsquo;s records and answers in plain
        words, each sentence linked to its record.
      </PageIntro>
      <AskClient />
    </>
  );
}
