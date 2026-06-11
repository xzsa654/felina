import { useMemo } from "react";
import { renderWithSourceMap } from "$lib/utils/markdown-source-map";

interface Props {
  markdown: string;
  className?: string;
  /** Escape embedded raw HTML — use for untrusted content like transcripts. */
  escapeHtml?: boolean;
}

export default function MarkdownPreview({ markdown, className, escapeHtml }: Props) {
  const html = useMemo(
    () => renderWithSourceMap(markdown, { escapeHtml }),
    [markdown, escapeHtml],
  );

  return (
    <div
      className={["md-preview", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
