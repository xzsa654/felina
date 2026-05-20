import { useMatch } from "react-router";
import { type Page } from "$lib/stores/navigation";

const PAGE_TITLES: Record<Page, string> = {
  skills: "Skills & Agents",
  settings: "Settings",
  templates: "Templates",
  memory: "Memory",
};

const PAGE_DESCRIPTIONS: Record<Page, string> = {
  skills: "Custom skills and agent definitions",
  settings: "Global and project configuration",
  templates: "Browse and add pre-built configurations",
  memory: "Project memory and context",
};

export default function Header() {
  const pageMatch = useMatch("/:pageId");
  const currentPage = (pageMatch?.params.pageId as Page) ?? "skills";

  return (
    <header className="flex items-center justify-between px-6 py-[7px] border-b border-border bg-bg-secondary">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          {PAGE_TITLES[currentPage]}
        </h2>
        <p className="text-sm text-text-muted">{PAGE_DESCRIPTIONS[currentPage]}</p>
      </div>
    </header>
  );
}
