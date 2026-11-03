// Calls a Convex function on the DEV deployment via the CLI (admin-authenticated; works for internal functions).
// CONVEX_RUN_PROD=1 targets production instead; only Tarik runs that (production writes are his call).
import { execFileSync } from "node:child_process";

export function convexRun<T = unknown>(fn: string, args: unknown): T {
  const out = execFileSync("npx", ["convex", "run", ...(process.env.CONVEX_RUN_PROD === "1" ? ["--prod"] : []), fn, JSON.stringify(args)], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 256 * 1024 * 1024 });
  const json = out.trim();
  return (json ? JSON.parse(json) : null) as T;
}
