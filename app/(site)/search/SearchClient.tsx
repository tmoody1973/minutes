"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";

const card = "rounded-xl border border-line bg-white";
const mono = "font-mono text-[11px] font-semibold tracking-[0.06em] text-muted";

// The query lives in the URL (?q=) so a search can be shared; results follow a 300 ms pause in typing. The URL is
// updated with the browser's own history API, which never asks the server, so typed words (maybe a home address)
// don't reach request logs while someone types.
export function SearchClient() {
  const params = useSearchParams();
  const pathname = usePathname();
  const [text, setText] = useState(params.get("q") ?? "");
  const [q, setQ] = useState(text.trim());

  useEffect(() => {
    const id = setTimeout(() => {
      const next = text.trim();
      setQ(next);
      window.history.replaceState(null, "", next ? `${pathname}?q=${encodeURIComponent(next)}` : pathname);
    }, 300);
    return () => clearTimeout(id);
  }, [text, pathname]);

  const results = useQuery(api.search.search, q.length >= 2 ? { q } : "skip");
  const total = results ? results.files.length + results.quotes.length : 0;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form role="search" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-1.5">
        <label htmlFor="search-box" className="text-[15px] font-bold">
          Search Minutes
        </label>
        <input
          id="search-box"
          type="search"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="711 E Kilbourn Ave, 260533, parking, “traffic”…"
          className="min-h-12 rounded-xl border-[1.5px] border-line bg-white px-3.5 text-base outline-none focus:border-link"
        />
      </form>

      <p role="status" className="text-[13px] text-muted">
        {q.length < 2 ? "Type at least two characters." : results === undefined ? "Searching…" : `${total} ${total === 1 ? "result" : "results"}`}
      </p>

      {results && results.files.length > 0 && (
        <section aria-labelledby="files-heading" className="flex flex-col gap-2">
          <h2 id="files-heading" className={mono}>
            FILES
          </h2>
          <ul className={`${card} flex flex-col divide-y divide-line`}>
            {results.files.map((f) => (
              <li key={f.href}>
                <Link href={f.href} className="flex min-h-11 flex-col gap-0.5 px-3.5 py-2.5 text-ink no-underline hover:bg-tint hover:text-ink">
                  <span className="text-[15px] font-bold leading-snug">{f.heading}</span>
                  <span className="line-clamp-2 text-[13px] leading-snug text-muted">{f.title}</span>
                  <span className="text-[12px] text-muted">
                    File {f.fileNumber} · {f.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.quotes.length > 0 && (
        <section aria-labelledby="quotes-heading" className="flex flex-col gap-2">
          <h2 id="quotes-heading" className={mono}>
            SAID IN MEETINGS
          </h2>
          <ul className={`${card} flex flex-col divide-y divide-line`}>
            {results.quotes.map((r, i) => (
              <li key={`${r.href}-${i}`}>
                <Link href={r.href} className="flex min-h-11 flex-col gap-1 px-3.5 py-2.5 text-ink no-underline hover:bg-tint hover:text-ink">
                  <span className="text-[15px] leading-snug">&ldquo;{r.text}&rdquo;</span>
                  <span className="text-[12px] text-muted">
                    {r.meeting} · at {r.at}
                    {r.captions && " · city's machine captions"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && total === 0 && (
        <p className="text-[15px]">
          Nothing matched &ldquo;{q}&rdquo;. Try a street name, a file number, or a single word. <Link href="/near">Search by address on the map</Link>.
        </p>
      )}
    </div>
  );
}
