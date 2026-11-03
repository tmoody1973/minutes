import { connection } from "next/server";
import { ThisWeek } from "../ThisWeek";

const HOUR = 3_600_000;

// Request time, not build time (cacheComponents): render inside Suspense; the clock is read after connection().
export async function WeekNow({ compact = false }: { compact?: boolean }) {
  await connection();
  // eslint-disable-next-line react-hooks/purity -- a server component reading request time after connection(), on purpose
  return <ThisWeek now={Math.floor(Date.now() / HOUR) * HOUR} compact={compact} />;
}
