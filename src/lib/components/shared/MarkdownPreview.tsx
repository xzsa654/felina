import { useMemo } from "react";
import { renderWithSourceMap } from "$lib/utils/markdown-source-map";

interface Props {
  markdown: string;
  className?: string;
}

export default function MarkdownPreview({ markdown, className }: Props) {
  const html = useMemo(() => renderWithSourceMap(markdown), [markdown]);

  return (
    <div
      className={["md-preview", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
