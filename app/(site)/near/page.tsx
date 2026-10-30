import type { Metadata } from "next";
import { PageIntro } from "../_components/PageIntro";
import { NearClient } from "./NearClient";

export const metadata: Metadata = { title: "Near me" };

export default function NearPage() {
  return (
    <>
      <PageIntro title="Development near you">Zoning and building proposals within half a mile, from Plan Commission to Council.</PageIntro>
      <NearClient />
    </>
  );
}
