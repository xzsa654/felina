import { Marked, type Token, type Tokens } from "marked";

const BLOCK_TYPES = new Set([
  "heading", "paragraph", "code", "list", "table", "blockquote", "hr",
]);

function injectAttr(html: string, line: number): string {
  const idx = html.indexOf(">");
  if (idx === -1) return html;
  return `${html.slice(0, idx)} data-source-line="${line}"${html.slice(idx)}`;
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface RenderOptions {
  /**
   * Render raw HTML embedded in the markdown as escaped literal text
   * instead of passing it through. Required for untrusted content
   * (e.g. session transcripts) — passthrough HTML executes in the
   * webview with invoke access.
   */
  escapeHtml?: boolean;
}

export function renderWithSourceMap(markdown: string, options?: RenderOptions): string {
  if (!markdown) return "";

  const instance = new Marked();

  if (options?.escapeHtml) {
    instance.use({
      renderer: {
        html({ text }: Tokens.HTML | Tokens.Tag) {
          return escapeHtmlText(text);
        },
      },
    });
  }

  instance.use({
    walkTokens(token: Token & { _srcLine?: number }) {
      if (!BLOCK_TYPES.has(token.type)) return;
    },
    renderer: {
      heading({ tokens, depth, _srcLine }: Tokens.Heading & { _srcLine?: number }) {
        const text = (this as unknown as { parser: { parseInline: (t: unknown[]) => string } }).parser.parseInline(tokens);
        const html = `<h${depth}>${text}</h${depth}>\n`;
        return _srcLine != null ? injectAttr(html, _srcLine) : html;
      },
      paragraph({ tokens, _srcLine }: Tokens.Paragraph & { _srcLine?: number }) {
        const text = (this as unknown as { parser: { parseInline: (t: unknown[]) => string } }).parser.parseInline(tokens);
        const html = `<p>${text}</p>\n`;
        return _srcLine != null ? injectAttr(html, _srcLine) : html;
      },
      code({ text, lang, _srcLine }: Tokens.Code & { _srcLine?: number }) {
        const langAttr = lang ? ` class="language-${lang}"` : "";
        const html = `<pre><code${langAttr}>${text}\n</code></pre>\n`;
        return _srcLine != null ? injectAttr(html, _srcLine) : html;
      },
      list({ items, ordered, start, _srcLine }: Tokens.List & { _srcLine?: number }) {
        const tag = ordered ? "ol" : "ul";
        const startAttr = ordered && start !== 1 ? ` start="${start}"` : "";
        let body = "";
        for (const item of items) {
          let itemBody = "";
          if (item.task) {
            const checked = item.checked ? ' checked=""' : "";
            itemBody += `<input${checked} disabled="" type="checkbox"> `;
          }
          itemBody += (this as unknown as { parser: { parse: (t: unknown[]) => string } }).parser.parse(item.tokens);
          body += `<li>${itemBody}</li>\n`;
        }
        const html = `<${tag}${startAttr}>\n${body}</${tag}>\n`;
        return _srcLine != null ? injectAttr(html, _srcLine) : html;
      },
      table({ header, rows, _srcLine }: Tokens.Table & { _srcLine?: number }) {
        const p = (this as unknown as { parser: { parseInline: (t: unknown[]) => string } }).parser;
        const parseInline = (t: unknown[]) => p.parseInline(t);
        let head = "<thead>\n<tr>\n";
        for (const cell of header) {
          const align = cell.align ? ` align="${cell.align}"` : "";
          head += `<th${align}>${parseInline(cell.tokens)}</th>\n`;
        }
        head += "</tr>\n</thead>\n";
        let body = "";
        if (rows.length) {
          body = "<tbody>\n";
          for (const row of rows) {
            body += "<tr>\n";
            for (const cell of row) {
              const align = cell.align ? ` align="${cell.align}"` : "";
              body += `<td${align}>${parseInline(cell.tokens)}</td>\n`;
            }
            body += "</tr>\n";
          }
          body += "</tbody>\n";
        }
        const html = `<table>\n${head}${body}</table>\n`;
        return _srcLine != null ? injectAttr(html, _srcLine) : html;
      },
      blockquote({ tokens, _srcLine }: Tokens.Blockquote & { _srcLine?: number }) {
        const body = (this as unknown as { parser: { parse: (t: unknown[]) => string } }).parser.parse(tokens);
        const html = `<blockquote>\n${body}</blockquote>\n`;
        return _srcLine != null ? injectAttr(html, _srcLine) : html;
      },
      hr({ _srcLine }: Tokens.Hr & { _srcLine?: number }) {
        const html = "<hr>\n";
        return _srcLine != null ? injectAttr(html, _srcLine) : html;
      },
    },
  });

  const tokens = instance.lexer(markdown);
  let line = 1;
  for (const token of tokens) {
    if (BLOCK_TYPES.has(token.type)) {
      (token as Token & { _srcLine?: number })._srcLine = line;
    }
    line += (token.raw.match(/\n/g) || []).length;
  }

  return instance.parser(tokens);
}
