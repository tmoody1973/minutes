"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { bodyLabel } from "../../../lib/ui/near";
import { alderContact, beHeard } from "../../../lib/ui/takePart";

// Who sits on the body that takes an item up next: the people a resident can contact before it decides.
// Names and roles as the city's office records give them, alphabetical; current members, synced nightly.
export function WhoDecides({ eventId }: { eventId: number }) {
  const r = useQuery(api.people.whoDecides, { eventId });
  if (!r?.members.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[15px] font-extrabold">Who decides</h3>
      <p className="text-[13px] text-muted">
        Members of the {bodyLabel(r.bodyName)}, from the city&rsquo;s records.
      </p>
      <ul className="flex flex-col gap-1 text-[14px]">
        {r.members.map((m) => (
          <li key={m.personId}>
            <span className="font-semibold">{m.name}</span>
            {m.role && <span className="text-muted"> · {m.role}</span>}
            {m.district !== undefined && <span className="text-muted"> · District {m.district}</span>}
            {m.district !== undefined && <Contact district={m.district} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The alderperson whose district a file's lot is in, from the Council's seat titles.
export function AlderFor({ district }: { district: number }) {
  const a = useQuery(api.people.alderFor, { district });
  if (!a) return null;
  return (
    <p className="text-[14px]">
      Alderperson for this lot: <span className="font-semibold">{a.name}</span>, District {a.district}
      <Contact district={a.district} />
    </p>
  );
}

// The alder's email and page as the city prints them, once Tarik approves the district's entry.
function Contact({ district }: { district: number }) {
  const c = alderContact(district);
  if (!c) return null;
  return (
    <span className="text-muted">
      {" · "}
      <a href={`mailto:${c.email}`} className="font-semibold">
        {c.email}
      </a>
      {" · "}
      <a href={c.page} className="font-semibold">
        City page
      </a>
    </span>
  );
}

// How the city says to take part before this body decides, from its own pages; nothing until approved.
export function HowToBeHeard({ body, titled = true }: { body: string; titled?: boolean }) {
  const rule = beHeard(body);
  if (!rule) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {titled && <h3 className="text-[15px] font-extrabold">How to be heard</h3>}
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px] leading-normal">
        {rule.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <a href={rule.url} className="flex min-h-11 items-center self-start text-[14px] font-semibold">
        The city&rsquo;s page
      </a>
    </div>
  );
}
