export interface ZoningChange {
  from?: string;
  to?: string;
  kind: "rezoning" | "dpd-amendment" | "minor-modification" | "text" | "other";
}

const FROM_RE = /change in zoning from (.+?)(?=,? known as|,? for the propert|,? located| to )/;
const TO_RE = / to (?:an? |the )?(?:new )?([A-Z].+?)(?=,? known as|,? and the \d|,? to allow|,? for the|,? at \d|$)/;

/** Classify a Legistar land-use title; district names are kept as written. */
export function parseZoningChange(title: string): ZoningChange {
  if (/Minor Modification to the Detailed Planned Development/i.test(title)) return { kind: "minor-modification" };
  const from = FROM_RE.exec(title);
  if (from) {
    const rest = title.slice(from.index + from[0].length);
    const to = TO_RE.exec(rest);
    return { ...(from[1] && { from: from[1] }), ...(to && { to: to[1] }), kind: "rezoning" };
  }
  if (/Amendment to the (?:Detailed Planned Development|DPD)/i.test(title)) return { kind: "dpd-amendment" };
  if (/relating to zoning regulations/i.test(title)) return { kind: "text" };
  return { kind: "other" };
}
