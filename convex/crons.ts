import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("sync recent events", { minutes: 30 }, internal.sync.syncRecent, {});
// 08:00 UTC = 2-3 AM Central.
// Matches new changes to follows; runs between syncs so alerts land within ~15 minutes of the record.
crons.interval("watcher", { minutes: 15 }, internal.watcher.runWatcher, {});
crons.cron("nightly full sync", "0 8 * * *", internal.sync.syncAll, {});

export default crons;
