/**
 * A tiny, dependency-free markdown → HTML renderer for the Notes panel.
 *
 * Deliberately a *safe subset*, not a spec-complete parser: headings, bold,
 * italic, strikethrough, inline + fenced code, links, blockquotes, horizontal
 * rules, and bullet / numbered / task lists. All text is HTML-escaped before
 * any markup is generated and link targets are whitelisted, so user content
 * can never inject markup or script — the output is safe for
 * dangerouslySetInnerHTML.
 */

/** Escape the HTML special characters so user text renders as literal text. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Allow only safe link targets; anything else renders as plain text. */
function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (/^[/#]/.test(u)) return u; // in-app / anchor links
  return null;
}

/** Inline formatting for one line of (raw) text. Escapes first, then applies a
 *  fixed set of safe transforms; inline code spans are shielded from the rest. */
function inline(textRaw: string): string {
  const text = escapeHtml(textRaw);
  // Split out `code` spans so their contents aren't re-formatted.
  return text
    .split(/(`[^`]+`)/g)
    .map((part) => {
      if (part.length >= 2 && part.startsWith("`") && part.endsWith("`")) {
        return `<code>${part.slice(1, -1)}</code>`;
      }
      let s = part;
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
        const href = safeHref(url);
        return href
          ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
          : label;
      });
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
      s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
      s = s.replace(/(^|[^_])_([^_\s][^_]*)_/g, "$1<em>$2</em>");
      s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
      return s;
    })
    .join("");
}

/** Render a markdown string to a safe HTML string. */
export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const n = lines.length;

  const isBlockStart = (line: string) =>
    /^```/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line) ||
    /^\s*$/.test(line);

  while (i < n) {
    const line = lines[i];

    // Fenced code block: ``` … ```
    if (/^```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < n && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++; // consume the closing fence (if present)
      out.push(`<pre><code>${body.map(escapeHtml).join("\n")}</code></pre>`);
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push("<hr/>");
      i++;
      continue;
    }

    // Blockquote (consecutive `>` lines)
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < n && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(`<blockquote>${buf.map(inline).join("<br/>")}</blockquote>`);
      continue;
    }

    // Lists (unordered or ordered; items may be `[ ]` / `[x]` task checkboxes)
    const ordered = /^\s*\d+\.\s+/.test(line);
    const itemRe = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
    if (itemRe.test(line)) {
      const items: string[] = [];
      while (i < n) {
        const m = lines[i].match(itemRe);
        if (!m) break;
        const task = m[1].match(/^\[([ xX])\]\s+(.*)$/);
        if (task) {
          const checked = task[1].toLowerCase() === "x" ? " checked" : "";
          items.push(
            `<li class="task"><input type="checkbox" disabled${checked}/>${inline(task[2])}</li>`,
          );
        } else {
          items.push(`<li>${inline(m[1])}</li>`);
        }
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    // Paragraph: gather lines until the next block / blank line.
    const para: string[] = [];
    while (i < n && !isBlockStart(lines[i])) para.push(lines[i++]);
    out.push(`<p>${para.map(inline).join("<br/>")}</p>`);
  }

  return out.join("\n");
}
