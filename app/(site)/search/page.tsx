import type { Metadata } from "next";
import { Suspense } from "react";
import { PageIntro } from "../_components/PageIntro";
import { SearchClient } from "./SearchClient";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <>
      <PageIntro title="Search">Find a file by number, address or subject, or find words said in a meeting.</PageIntro>
      <Suspense>
        <SearchClient />
      </Suspense>
    </>
  );
}
