import type { AuthConfig } from "convex/server";

// Clerk sign-in (spec: browsing is public; following and alerts need an account). The issuer is the Clerk
// Frontend API URL, set per deployment: `npx convex env set CLERK_JWT_ISSUER_DOMAIN <url>`.
export default {
  providers: [{ domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, applicationID: "convex" }],
} satisfies AuthConfig;
