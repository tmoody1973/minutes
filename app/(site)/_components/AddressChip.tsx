"use client";

import Link from "next/link";
import { chipText } from "../../../lib/ui/near";
import { Icon } from "./Nav";
import { useSavedPlace } from "./savedPlace";

// Header chip: the saved address, or an invitation to set one. Both lead to Near me.
export function AddressChip() {
  const place = useSavedPlace();
  return (
    <Link
      href="/near"
      className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 text-sm font-semibold text-ink no-underline hover:border-ink hover:text-ink"
    >
      <Icon name="pin" size={14} />
      <span className="truncate">{place ? chipText(place) : "Set your address"}</span>
    </Link>
  );
}
