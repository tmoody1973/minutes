"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Concern } from "../../../lib/ask/agent";
import { concernWords, MAX_CONCERN_WORDS } from "../../../lib/watcher/match";

const button = "inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-bold";
const field = "min-h-11 rounded-xl border-[1.5px] border-line bg-white px-3 text-base outline-none placeholder:text-muted focus:border-link";

// Follow this (decision 008): Muse proposes the words, the person edits them, and only the name and words are saved,
// never the question. The Watcher emails when a file whose title has any word is introduced, put on an agenda or decided.
export function FollowConcern({ proposed }: { proposed?: Concern }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isSignedIn } = useAuth();
  const follow = useMutation(api.follows.follow);
  const [words, setWords] = useState<string[]>(proposed?.words ?? []);
  const [name, setName] = useState(proposed?.name ?? "");
  const [adding, setAdding] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });

  const add = () => {
    const next = concernWords([...words, adding]);
    if (next.length > words.length) setWords(next);
    setAdding("");
  };
  const save = async () => {
    setState({ kind: "saving" });
    try {
      await follow({ kind: "topic", value: words.join(", "), label: name.trim() || words.join(", ") });
      setState({ kind: "saved" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "That didn't work. Try again." });
    }
  };

  if (state.kind === "saved") {
    return (
      <section aria-labelledby="follow-heading" className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-4" role="status">
        <h2 id="follow-heading" className="text-[17px] font-extrabold">
          Following &ldquo;{name.trim() || words.join(", ")}&rdquo;
        </h2>
        <p className="text-[15px] text-muted">
          Minutes will email you when a file with {words.length === 1 ? "this word" : "any of these words"} in its title is introduced, put on an
          agenda or decided. <Link href="/following">See what you follow</Link>.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="follow-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-col gap-1">
        <h2 id="follow-heading" className="text-[17px] font-extrabold">
          Follow this
        </h2>
        <p className="text-[15px] text-muted">
          Get an email when a file with any of these words in its title is introduced, put on an agenda or decided.
        </p>
      </div>

      <ul aria-label="Words to watch for" className="flex flex-wrap gap-2">
        {words.map((w) => (
          <li key={w} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-tint pl-3.5 text-[15px] font-semibold text-ink">
            {w}
            <button
              type="button"
              aria-label={`Remove ${w}`}
              onClick={() => setWords(words.filter((x) => x !== w))}
              className="grid size-11 place-items-center rounded-full text-[18px] text-muted hover:text-ink"
            >
              ×
            </button>
          </li>
        ))}
        {words.length === 0 && <li className="text-[15px] text-muted">Add a word or phrase to watch for.</li>}
      </ul>

      {words.length < MAX_CONCERN_WORDS && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex gap-2"
        >
          <label htmlFor="follow-add" className="sr-only">
            Add a word to watch for
          </label>
          <input id="follow-add" value={adding} maxLength={40} onChange={(e) => setAdding(e.target.value)} placeholder="Add a word, like tavern" className={`${field} min-w-0 flex-1`} />
          <button type="submit" disabled={adding.trim().length < 3} className={`${button} border-[1.5px] border-link bg-white text-link hover:bg-tint disabled:border-line disabled:text-muted`}>
            Add
          </button>
        </form>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="follow-name" className="text-[14px] font-bold">
          Name
        </label>
        <input id="follow-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Police cameras" className={field} />
      </div>

      <p className="text-[13px] text-muted">Minutes saves this name and these words to your account, not your question.</p>

      {isLoading ? (
        <button type="button" disabled className={`${button} self-start bg-line text-muted`}>
          Follow
        </button>
      ) : !isAuthenticated && isSignedIn ? (
        <p role="alert" className="text-[13px] font-semibold text-amber-fg">
          You&rsquo;re signed in, but Minutes couldn&rsquo;t connect your account. Reload the page and try again.
        </p>
      ) : !isAuthenticated ? (
        // A modal keeps this answer on screen; after signing in, Follow is one more tap.
        <SignInButton mode="modal">
          <button type="button" disabled={!words.length} className={`${button} self-start bg-link text-white hover:bg-ink disabled:bg-line disabled:text-muted`}>
            Sign in to follow
          </button>
        </SignInButton>
      ) : (
        <button type="button" onClick={save} disabled={!words.length || state.kind === "saving"} className={`${button} self-start bg-link text-white hover:bg-ink disabled:bg-line disabled:text-muted`}>
          {state.kind === "saving" ? "Following…" : "Follow"}
        </button>
      )}
      {state.kind === "error" && (
        <p role="alert" className="text-[13px] font-semibold text-amber-fg">
          {state.message}
        </p>
      )}
    </section>
  );
}
