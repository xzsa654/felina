import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { KnownProject } from "$lib/types";
import { api } from "$lib/tauri/commands";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";

interface Props {
  projects: KnownProject[];
  loaded: boolean;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** Called after a saved entry is removed from the Known Projects list. */
  onRemoved: () => void;
}


/**
 * Left column of the Projects view: the Known Projects list. Entries are
 * pre-sorted by the page; this component only renders. `exists=false` shows a
 * "project not found" indicator (reusing the target-degradation visual).
 */
export default function ProjectsList({ projects, loaded, selectedPath, onSelect, onRemoved }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  async function confirmRemove() {
    const path = pendingRemove;
    setPendingRemove(null);
    if (!path) return;
    try {
      await api.knownProjects.remove(path);
      onRemoved();
    } catch (e) {
      window.alert(t(locale, "projects.list.removeFailed", { error: String(e) }));
    }
  }

  if (!loaded) {
    return <div className="text-sm text-text-secondary p-4">{t(locale, "projects.list.loading")}</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="text-xs text-text-secondary p-4 leading-relaxed">
        {t(locale, "projects.list.empty")}
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
            className="flex items-stretch"
          >
            <button
              type="button"
              onClick={() => onSelect(p.path)}
              className={`flex-1 min-w-0 text-left mx-2 rounded-md px-3 py-2 transition-colors ${
                selected ? "bg-bg-secondary text-text-primary" : "text-text-secondary hover:bg-bg-secondary/50 hover:text-text-primary"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate" title={p.path}>
                  {name}
                </span>
                {!p.exists && (
                  <span
                    className="inline-flex items-center gap-1 text-danger shrink-0 text-[11px]"
                    title={t(locale, "projects.list.notFoundTooltip")}
                  >
                    <AlertTriangle size={11} /> {t(locale, "projects.list.notFound")}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-muted truncate" title={p.path}>
                {p.path}
              </div>
            </button>
            {removable && (
              <button
                type="button"
                onClick={() => setPendingRemove(p.path)}
                title={t(locale, "projects.list.removeTooltip")}
                className="px-2 shrink-0 text-text-muted hover:text-danger"
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
      title={t(locale, "projects.removeDialog.title")}
      message={
        pendingRemove
          ? t(locale, "projects.removeDialog.message", { path: pendingRemove })
          : ""
      }
      confirmLabel={t(locale, "projects.removeDialog.confirm")}
      onconfirm={() => void confirmRemove()}
      oncancel={() => setPendingRemove(null)}
    />
    </>
  );
}
