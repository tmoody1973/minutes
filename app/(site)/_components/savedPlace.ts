"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseSavedPlace, type SavedPlace } from "../../../lib/ui/near";

// The resident's address stays in this browser only; Minutes never stores it server-side.
const KEY = "minutes:place";
const CHANGED = "minutes:place-changed";
// Fallback when storage is blocked (some private modes): the place lasts for this visit only.
let memory: string | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

export function useSavedPlace(): SavedPlace | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => parseSavedPlace(raw), [raw]);
}

export function savePlace(place: SavedPlace | null) {
  memory = place ? JSON.stringify(place) : null;
  try {
    if (place) localStorage.setItem(KEY, JSON.stringify(place));
    else localStorage.removeItem(KEY);
  } catch {
    // Not persisted; read() serves the in-memory copy for this visit.
  }
  window.dispatchEvent(new Event(CHANGED));
}
