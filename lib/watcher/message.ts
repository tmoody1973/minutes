// The text of an alert, built only from stored record fields (records, not opinions). Pure.
import { actionText, stepDate } from "../ui/file";
import { bodyLabel, placeHeading } from "../ui/near";

export type AlertFacts =
  | { kind: "hearing_scheduled"; fileNumber: string; title: string; bodyName?: string; startsAt?: string }
  | { kind: "decision"; fileNumber: string; title: string; bodyName?: string; date: string; actionName?: string };

export function alertMessage(f: AlertFacts): { message: string; href: string } {
  const heading = placeHeading(f.title, f.fileNumber);
  const href = `/files/${f.fileNumber}`;
  if (f.kind === "hearing_scheduled") {
    const where = f.bodyName ? `the ${bodyLabel(f.bodyName)} agenda` : "a meeting agenda";
    const when = f.startsAt ? ` for ${stepDate(f.startsAt.slice(0, 10), f.startsAt)}` : "";
    return { message: `${heading} is on ${where}${when}.`, href };
  }
  const what = f.actionName ? actionText([f.actionName]) : "Decision recorded";
  const where = f.bodyName ? ` at ${bodyLabel(f.bodyName)}` : "";
  return { message: `${heading}: ${what}${where}, ${stepDate(f.date.slice(0, 10))}.`, href };
}
