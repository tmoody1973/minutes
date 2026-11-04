// A document's text, from pdftotext, as short passages Ask can search and cite. Pure.
// Short, because Ask shows the model the first 500 characters of a record and the Editor checks a sentence against
// the whole record: a short passage keeps what the model read and what the Editor checks the same.
export const PASSAGE_CHARS = 600;
// ponytail: the first 100 passages (~60,000 characters) of a document; most staff reports and fiscal notes fit.
export const MAX_PASSAGES = 100;

export function toPassages(text: string, size = PASSAGE_CHARS, max = MAX_PASSAGES): string[] {
  // A blank line or a page break ends a paragraph; single line breaks inside one are the PDF's layout.
  const paragraphs = text
    .split(/\n\s*\n|\f/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  let cur = "";
  const push = () => {
    if (cur) out.push(cur);
    cur = "";
  };
  for (const p of paragraphs) {
    for (const word of p.split(" ")) {
      const piece = word.length > size ? word.slice(0, size) : word;
      if (cur && cur.length + 1 + piece.length > size) push();
      cur = cur ? `${cur} ${piece}` : piece;
    }
    // A paragraph that fits with the next stays together; otherwise it closes its passage.
    if (cur.length > size / 2) push();
    if (out.length >= max) break;
  }
  push();
  return out.slice(0, max);
}
