import type { Metadata } from "next";
import { Suspense } from "react";
import { FileClient } from "./FileClient";

export const metadata: Metadata = { title: "Project" };

// FileClient reads the file number from the URL, which cacheComponents requires inside <Suspense>.
export default function FilePage() {
  return (
    <Suspense fallback={<p className="text-[15px] text-muted">Loading file…</p>}>
      <FileClient />
    </Suspense>
  );
}
