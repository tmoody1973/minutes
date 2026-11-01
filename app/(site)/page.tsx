import { connection } from "next/server";
import { Suspense } from "react";
import { PageIntro } from "./_components/PageIntro";
import { ThisWeek } from "./ThisWeek";

const HOUR = 3_600_000;

// Request time, not build time (cacheComponents): the clock is read inside Suspense after connection().
async function Week() {
  await connection();
  // eslint-disable-next-line react-hooks/purity -- a server component reading request time after connection(), on purpose
  return <ThisWeek now={Math.floor(Date.now() / HOUR) * HOUR} />;
}

export default function ThisWeekPage() {
  return (
    <>
      <PageIntro title="This week at City Hall">Zoning and development hearings coming up, and what was decided, from the city&apos;s records.</PageIntro>
      <Suspense fallback={<p className="text-[15px] text-muted">Loading this week…</p>}>
        <Week />
      </Suspense>
    </>
  );
}
