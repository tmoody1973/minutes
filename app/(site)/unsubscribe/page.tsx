import type { Metadata } from "next";
import { Suspense } from "react";
import { PageIntro } from "../_components/PageIntro";
import { UnsubscribeClient } from "./UnsubscribeClient";

export const metadata: Metadata = { title: "Unsubscribe" };

export default function UnsubscribePage() {
  return (
    <>
      <PageIntro title="Alert emails">Every alert email has this link.</PageIntro>
      <Suspense>
        <UnsubscribeClient />
      </Suspense>
    </>
  );
}
