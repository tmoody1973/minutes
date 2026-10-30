"use client";

import { useAction, useQuery } from "convex/react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import {
  distanceLabel,
  emptyMessage,
  FILTERS,
  hearingLabel,
  kindLabel,
  type NearFilter,
  placeHeading,
  type SavedPlace,
  shortAddress,
} from "../../../lib/ui/near";
import { savePlace, useSavedPlace } from "../_components/savedPlace";

const GEOCODE_ERRORS = {
  "not-found": "We couldn't find that address. Try a house number and street, like 711 E Kilbourn Ave.",
  "outside-milwaukee": "That address is outside the City of Milwaukee. Minutes covers city records only.",
  busy: "Address lookups are busy right now. Try again in a minute.",
  unavailable: "The address lookup service isn't responding. Try again in a minute.",
} as const;

const textButton = "min-h-11 font-semibold text-link underline underline-offset-[0.18em] hover:text-ink";

// Focus follows the task for keyboard and screen-reader users: to the results after a lookup or cancel, to the
// input after "Change address" or "Forget this address" (otherwise focus would drop to the page body).
export function NearClient() {
  const place = useSavedPlace();
  const [editing, setEditing] = useState(false);
  const [focus, setFocus] = useState<"results" | "input" | null>(null);
  const nearRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (focus === "results" && place && !editing) nearRef.current?.focus();
  }, [focus, place, editing]);

  if (!place || editing) {
    return (
      <AddressForm
        focusInput={focus === "input"}
        onDone={() => {
          setEditing(false);
          setFocus("results");
        }}
        canCancel={!!place}
      />
    );
  }
  return (
    <>
      <p ref={nearRef} tabIndex={-1} className="text-[15px] text-muted">
        Near <span className="font-semibold text-ink">{shortAddress(place.matchedAddress)}</span> ·{" "}
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setFocus("input");
          }}
          className={textButton}
        >
          Change address
        </button>{" "}
        ·{" "}
        <button
          type="button"
          onClick={() => {
            savePlace(null);
            setFocus("input");
          }}
          className={textButton}
        >
          Forget this address
        </button>
      </p>
      <Results place={place} />
    </>
  );
}

function AddressForm({ onDone, canCancel, focusInput }: { onDone: () => void; canCancel: boolean; focusInput: boolean }) {
  const geocode = useAction(api.near.geocode);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusInput) inputRef.current?.focus();
  }, [focusInput]);
  const [text, setText] = useState("");
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFinding(true);
    setError(null);
    try {
      const r = await geocode({ text });
      if ("error" in r) setError(GEOCODE_ERRORS[r.error]);
      else {
        savePlace({ lat: r.lat, lng: r.lng, matchedAddress: r.matchedAddress, ...(r.district && { district: r.district }) });
        onDone();
      }
    } catch {
      setError("Couldn't reach Minutes. Check your connection and try again.");
    } finally {
      setFinding(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-2">
      <label htmlFor="address" className="text-[15px] font-bold">
        Your address
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id="address"
          name="address"
          autoComplete="street-address"
          required
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby={error ? "address-error address-note" : "address-note"}
          aria-invalid={error ? true : undefined}
          placeholder="711 E Kilbourn Ave"
          className="min-h-12 min-w-0 flex-1 basis-60 rounded-[10px] border-[1.5px] border-ink bg-white px-3.5 text-base text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={finding}
          className="min-h-12 rounded-[10px] bg-link px-5 text-[15px] font-bold text-white hover:bg-ink disabled:cursor-wait disabled:opacity-70"
        >
          {finding ? "Finding…" : "Find files"}
        </button>
        {canCancel && (
          <button type="button" onClick={onDone} className="min-h-12 rounded-[10px] border-[1.5px] border-ink bg-white px-5 text-[15px] font-bold text-ink">
            Cancel
          </button>
        )}
      </div>
      <p id="address-error" role="alert" className="text-[15px] font-semibold text-amber-fg empty:hidden">
        {error}
      </p>
      <p id="address-note" className="text-[13px] text-muted">
        We look up your address in city property records (or the U.S. Census geocoder) and keep it only on this device.
      </p>
    </form>
  );
}

function Results({ place }: { place: SavedPlace }) {
  const [filter, setFilter] = useState<NearFilter>("all");
  const rows = useQuery(api.near.filesNear, { lat: place.lat, lng: place.lng, filter });

  return (
    <section aria-label="Files near you" className="flex flex-col gap-3">
      <div role="group" aria-label="Filter" className="flex flex-wrap gap-2">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`min-h-11 rounded-full border-[1.5px] border-ink px-4 text-sm font-semibold ${
              filter === id ? "bg-ink text-white" : "bg-white text-ink hover:bg-paper"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mounted before results arrive so screen readers announce each change (loading, count, empty). */}
      <p role="status" className="text-[15px] text-muted">
        {rows === undefined
          ? "Loading files near you…"
          : rows.length === 0
            ? emptyMessage(filter)
            : `${rows.length} ${rows.length === 1 ? "file" : "files"} within half a mile`}
      </p>

      {rows && rows.length > 0 && (
        <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.matterId}>
              <Link
                href={`/files/${r.fileNumber}`}
                className="flex h-full flex-col gap-1.5 rounded-xl border border-line bg-white p-3.5 text-ink no-underline hover:border-link hover:text-ink"
              >
                <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted">
                  {kindLabel(r.kind)} · FILE {r.fileNumber}
                  <span className="sr-only">. </span>
                </span>
                <span className="text-[17px] font-extrabold leading-tight">{placeHeading(r.title, r.fileNumber)}</span>
                <span
                  className={`self-start rounded-xl px-2.5 py-1 text-[13px] font-bold ${
                    r.nextHearing ? "bg-amber-bg text-amber-fg" : "bg-map text-ink"
                  }`}
                >
                  {r.nextHearing ? hearingLabel(r.nextHearing) : r.statusName}
                </span>
                <span className="text-[13px] text-muted">{distanceLabel(r.distanceMi)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
