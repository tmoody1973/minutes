// Kick off a full sync on the dev deployment (CONVEX_DEPLOYMENT in .env.local). Never targets prod.
import { execFileSync } from "node:child_process";

execFileSync("npx", ["convex", "run", "sync:syncAll"], { stdio: "inherit" });
