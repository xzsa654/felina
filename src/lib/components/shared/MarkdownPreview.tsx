import { useMemo } from "react";
import { marked } from "marked";

interface Props {
  markdown: string;
  className?: string;
}

export default function MarkdownPreview({ markdown, className }: Props) {
  const html = useMemo(() => marked(markdown || "") as string, [markdown]);

  return (
    <div
      className={["md-preview", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
