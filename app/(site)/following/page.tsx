import type { Metadata } from "next";
import { PageIntro } from "../_components/PageIntro";
import { FollowingClient } from "./FollowingClient";

export const metadata: Metadata = { title: "Following" };

export default function FollowingPage() {
  return (
    <>
      <PageIntro title="Following">Alerts only when a hearing is scheduled or a decision is made on something you follow.</PageIntro>
      <FollowingClient />
    </>
  );
}
