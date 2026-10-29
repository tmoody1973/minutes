import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("sync recent events", { minutes: 30 }, internal.sync.syncRecent, {});
// 08:00 UTC = 2-3 AM Central.
crons.cron("nightly full sync", "0 8 * * *", internal.sync.syncAll, {});

export default crons;
