// The only module UI code should import for zoning terms. Entry data lives in glossary-data.ts and is reachable
// from the UI solely through `lookup`, which never returns a `plain` line the builder has not approved.
import { GLOSSARY_DATA, type GlossaryEntry } from "./glossary-data";

export type { GlossaryEntry };

/** The only way to read `plain`: unapproved or missing entries yield null. */
export function displayable(entry: GlossaryEntry | undefined): string | null {
  return entry?.approved ? entry.plain : null;
}

export interface GlossaryLookup {
  term: string;
  code?: string;
  plain: string | null;
  officialText: string;
  officialUrl: string;
  section: string;
}

/** Pure lookup over any entry table (exported so tests can pass an approved copy). */
export function lookupIn(entries: Readonly<Record<string, GlossaryEntry>>, codeOrTerm: string): GlossaryLookup | null {
  const e = Object.hasOwn(entries, codeOrTerm) ? entries[codeOrTerm] : undefined;
  if (!e) return null;
  return { term: e.term, code: e.code, plain: displayable(e), officialText: e.officialText, officialUrl: e.officialUrl, section: e.section };
}

/** Look up a district code ("RT4") or term key ("special use"). `plain` is null until the builder approves it. */
export function lookup(codeOrTerm: string): GlossaryLookup | null {
  return lookupIn(GLOSSARY_DATA, codeOrTerm);
}
