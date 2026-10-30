import type { Metadata } from "next";
import { PageIntro } from "../_components/PageIntro";

export const metadata: Metadata = { title: "Following" };

export default function FollowingPage() {
  return <PageIntro title="Following">Following files, addresses and alderpersons is coming soon.</PageIntro>;
}
