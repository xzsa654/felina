import { AlertTriangle } from "lucide-react";
import type { KnownProject, ProjectSource } from "$lib/types";

interface Props {
  projects: KnownProject[];
  loaded: boolean;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

const SOURCE_LABEL: Record<ProjectSource, string> = {
  cwd: "cwd",
  detected: "detected",
  saved: "saved",
};

/**
 * Left column of the Projects view: the Known Projects list. Entries are
 * pre-sorted by the page; this component only renders. `exists=false` shows a
 * "project not found" indicator (reusing the target-degradation visual).
 */
export default function ProjectsList({ projects, loaded, selectedPath, onSelect }: Props) {
  if (!loaded) {
    return <div className="text-sm text-text-secondary p-4">Loading…</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="text-xs text-text-secondary p-4 leading-relaxed">
        No known projects yet. Add one via the Skills import flow / Browse, or
        manage global skills on the Skills page.
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {projects.map((p) => {
        const name = p.path.split("/").pop() || p.path;
        const selected = p.path === selectedPath;
        return (
          <li key={p.path}>
            <button
              type="button"
              onClick={() => onSelect(p.path)}
              className={`w-full text-left px-3 py-2 border-b border-border/50 ${
                selected
                  ? "bg-accent/10 text-text-primary"
                  : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate" title={p.path}>
                  {name}
                </span>
                {!p.exists && (
                  <span
                    className="inline-flex items-center gap-1 text-red-400 shrink-0 text-[11px]"
                    title="此 project 資料夾不存在（已被刪除/改名/卸載）"
                  >
                    <AlertTriangle size={11} /> not found
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-muted truncate" title={p.path}>
                {p.path}
              </div>
              <div className="flex gap-1 mt-1">
                {p.sources.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary border border-border text-text-muted"
                  >
                    {SOURCE_LABEL[s]}
                  </span>
                ))}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
