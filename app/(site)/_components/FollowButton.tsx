"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

type Kind = "file" | "address" | "alder" | "topic";
const pill = "min-h-11 rounded-full border-[1.5px] border-link px-4 text-sm font-bold";

// Follow / Following toggle (mockup MinPhoneTracker). Signed out, it opens Clerk sign-in; browsing never needs it.
export function FollowButton({ kind, value, label, text = "Follow" }: { kind: Kind; value: string; label: string; text?: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSignedIn } = useAuth();
  const following = useQuery(api.follows.isFollowing, isAuthenticated ? { kind, value } : "skip");
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <button type="button" disabled className={`${pill} bg-white text-link opacity-60`}>
        {text}
      </button>
    );
  }
  // Signed in to Clerk but Convex refused the token (e.g. the Clerk Convex integration is off): sign-in would only error.
  if (!isAuthenticated && isSignedIn) {
    return (
      <span role="alert" className="text-[13px] font-semibold text-amber-fg">
        You&rsquo;re signed in, but Minutes couldn&rsquo;t connect your account. Reload the page and try again.
      </span>
    );
  }
  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <button type="button" className={`${pill} bg-white text-link hover:bg-tint`}>
          {text}
        </button>
      </SignInButton>
    );
  }
  const on = following === true;
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={on}
        onClick={async () => {
          setError(null);
          try {
            if (on) await unfollow({ kind, value });
            else await follow({ kind, value, label });
          } catch (err) {
            setError(err instanceof Error ? err.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "That didn't work. Try again.");
          }
        }}
        className={`${pill} ${on ? "bg-link text-white hover:bg-ink" : "bg-white text-link hover:bg-tint"}`}
      >
        {on ? "Following" : text}
      </button>
      {error && (
        <span role="alert" className="text-[13px] font-semibold text-amber-fg">
          {error}
        </span>
      )}
    </span>
  );
}
