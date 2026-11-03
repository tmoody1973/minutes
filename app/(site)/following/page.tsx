import type { Metadata } from "next";
import { PageIntro } from "../_components/PageIntro";
import { FollowingClient } from "./FollowingClient";

export const metadata: Metadata = { title: "Following" };

export default function FollowingPage() {
  return (
    <>
      <PageIntro title="Following">Alerts only when something you follow is introduced, scheduled for a hearing or decided.</PageIntro>
      <FollowingClient />
    </>
  );
}
