import { clerkMiddleware } from "@clerk/nextjs/server";

// Bare middleware (Clerk guidance): it only makes the session available. Pages stay public; Convex functions
// check identity themselves.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
