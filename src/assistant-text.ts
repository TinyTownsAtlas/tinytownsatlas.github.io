/**
 * Turns the assistant's reply (plain text with **bold**, "- " bullets and [text](url) links) into a
 * small structure the UI renders with createElement/textContent. No HTML is ever parsed, and only
 * links to the Atlas itself are kept as links.
 */

export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "link"; text: string; href: string };
export type Block = { kind: "p"; inline: Inline[] } | { kind: "ul"; items: Inline[][] };

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Hosts a reply may link to: the Atlas production site and wherever the page itself is served. */
export function isAtlasHref(href: string, pageHost: string): boolean {
  try {
    const url = new URL(href);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      (url.hostname === "tinytownsatlas.github.io" || url.hostname === pageHost);
  } catch {
    return false;
  }
}

export function parseInline(line: string, pageHost: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    if (m.index! > last) out.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (isAtlasHref(m[3], pageHost)) out.push({ kind: "link", text: m[2], href: m[3] });
    else out.push({ kind: "text", text: m[2] }); // drop links to anywhere else, keep the words
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}

export function parseAnswer(text: string, pageHost: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] | null = null;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "p", inline: parseInline(paragraph.join(" "), pageHost) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: "ul", items: list });
    list = null;
  };
  for (let line of text.replace(/\r\n/g, "\n").split("\n")) {
    line = line.replace(/^\s*#{1,6}\s+/, ""); // headings are shown as plain lines
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      (list ??= []).push(parseInline(bullet[1], pageHost));
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
