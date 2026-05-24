import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { KnownProject, ProjectSource } from "$lib/types";
import { api } from "$lib/tauri/commands";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";

interface Props {
  projects: KnownProject[];
  loaded: boolean;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** Called after a saved entry is removed from the Known Projects list. */
  onRemoved: () => void;
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
export default function ProjectsList({ projects, loaded, selectedPath, onSelect, onRemoved }: Props) {
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  async function confirmRemove() {
    const path = pendingRemove;
    setPendingRemove(null);
    if (!path) return;
    try {
      await api.knownProjects.remove(path);
      onRemoved();
    } catch (e) {
      window.alert(`Remove failed: ${e}`);
    }
  }

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
    <>
    <ul className="flex flex-col">
      {projects.map((p) => {
        const name = p.path.split("/").pop() || p.path;
        const selected = p.path === selectedPath;
        // Only saved (L3) entries can be removed from the list — detected/cwd
        // are derived and would reappear on the next scan. Surface the remove
        // affordance for not-found saved entries (the cleanup case).
        const removable = !p.exists && p.sources.includes("saved");
        return (
          <li
            key={p.path}
            className={`flex items-stretch border-b border-border/50 ${
              selected
                ? "bg-accent/10"
                : "hover:bg-bg-secondary"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(p.path)}
              className={`flex-1 min-w-0 text-left px-3 py-2 ${
                selected ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
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
            {removable && (
              <button
                type="button"
                onClick={() => setPendingRemove(p.path)}
                title="從 Known Projects 清單移除此 saved 條目（不會刪除任何實際資料夾）"
                className="px-2 shrink-0 text-text-muted hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
    <ConfirmDialog
      open={pendingRemove !== null}
      title="從清單移除 project"
      message={
        pendingRemove
          ? `將「${pendingRemove}」從 Known Projects 清單（saved 條目）移除。\n\n只會移除清單記錄，不會刪除任何實際資料夾。`
          : ""
      }
      confirmLabel="移除"
      onconfirm={() => void confirmRemove()}
      oncancel={() => setPendingRemove(null)}
    />
    </>
  );
}
