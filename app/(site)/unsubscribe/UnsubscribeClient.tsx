"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";

// Landing page for the link in every alert email. Turns email off; on-site alerts continue.
export function UnsubscribeClient() {
  const token = useSearchParams().get("token") ?? "";
  const unsubscribe = useMutation(api.watcher.unsubscribe);
  const [state, setState] = useState<"working" | "done" | "invalid" | "error">("working");
  useEffect(() => {
    unsubscribe({ token })
      .then((r) => setState(r.ok ? "done" : "invalid"))
      .catch(() => setState("error"));
  }, [token, unsubscribe]);
  const text = {
    working: "Turning off alert emails…",
    done: "Alert emails are off. Your alerts still appear on the Following page.",
    invalid: "This link isn't valid anymore. You can turn emails off on the Following page.",
    error: "Couldn't reach Minutes. Try the link again in a minute.",
  }[state];
  return (
    <p role="status" className="max-w-[65ch] text-base">
      {text} {state !== "working" && <Link href="/following">Go to Following</Link>}
    </p>
  );
}
