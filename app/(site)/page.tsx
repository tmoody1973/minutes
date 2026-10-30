import Link from "next/link";
import { PageIntro } from "./_components/PageIntro";

export default function ThisWeekPage() {
  return (
    <PageIntro title="This week at City Hall">
      The weekly summary is coming soon. Until then, <Link href="/near">find development near you</Link>.
    </PageIntro>
  );
}
