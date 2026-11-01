"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "../../../convex/_generated/api";

const asOf = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });

// The Clerk agent's plain-language card (brief §6.2), shown only as the Editor approved it: every sentence was
// checked against the records named below it. No card yet → the record-derived fallback.
export function PlainCard({ kind, cardKey, fallback, className = "" }: { kind: "file" | "chapter"; cardKey: string; fallback?: ReactNode; className?: string }) {
  const card = useQuery(api.editor.card, { kind, key: cardKey });
  if (!card) return <>{fallback ?? null}</>;
  const sources = [...new Set(card.sentences.flatMap((s) => s.sources))];
  return (
    <div className={`flex max-w-[65ch] flex-col gap-1 ${className}`}>
      <p className="text-[17px] leading-[1.45]">{card.sentences.map((s) => s.text).join(" ")}</p>
      <p className="text-[13px] leading-[1.4] text-muted">
        Summary written from the city&rsquo;s records as of {asOf(card.writtenAt)}, each sentence checked against its source: {sources.join(" · ")}.
      </p>
    </div>
  );
}
