// CSV for the journalist downloads (meeting votes, file history). toCsv is pure; downloadCsv needs a browser.

// RFC 4180: a field with a comma, quote or line break is quoted, inner quotes doubled; rows end in CRLF.
export const toCsv = (rows: string[][]): string =>
  rows.map((r) => r.map((f) => (/[",\r\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f)).join(",")).join("\r\n") + "\r\n";

// The byte-order mark lets Excel read the file as UTF-8 (tallies use an en dash: "Vote 5–0").
export function downloadCsv(filename: string, rows: string[][]): void {
  const url = URL.createObjectURL(new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  // Revoked on the next tick: revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
