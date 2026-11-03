// Who sits on a body, as Legistar's office records list them. Pure.

// Legistar writes people in capitals ("ALD. A. PRATT").
export const memberName = (s: string) => s.trim().toLowerCase().replace(/(^|[\s.-])(\w)/g, (_, a: string, c: string) => a + c.toUpperCase());

/** A Common Council seat's title in Legistar is its district: "4th District" -> 4. */
export function districtOf(role?: string): number | null {
  const m = /^(\d{1,2})(?:st|nd|rd|th) District$/i.exec(role?.trim() ?? "");
  return m ? Number(m[1]) : null;
}

export interface Member { personId: number; name: string; role?: string; district?: number }

/** Alphabetical: a neutral order with no special place for any member. Roles ("Chair") are shown, not ranked. */
export const sortMembers = (ms: Member[]): Member[] => [...ms].sort((a, b) => a.name.localeCompare(b.name));
