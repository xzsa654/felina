import { useEffect, useState } from "react";
import { AlertTriangle, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";
import { api } from "$lib/tauri/commands";
import type { KnownProject } from "$lib/types";

export default function SavedKnownProjectsSection() {
  const locale = useLocaleStore((s) => s.locale);
  const [projects, setProjects] = useState<KnownProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<KnownProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setProjects(await api.knownProjects.savedList());
    } catch (e) {
      setError(t(locale, "felinaSettings.savedProjects.loadError", { error: String(e) }));
    } finally {
      setLoading(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    const path = pendingRemove.path;
    setRemoving(path);
    setError(null);
    try {
      await api.knownProjects.remove(path);
      setPendingRemove(null);
      await reload();
    } catch (e) {
      setError(t(locale, "felinaSettings.savedProjects.removeError", { error: String(e) }));
    } finally {
      setRemoving(null);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-lg border border-border bg-bg-secondary">
      <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            {t(locale, "felinaSettings.savedProjects.title")}
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            {t(locale, "felinaSettings.savedProjects.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-50"
          disabled={loading}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {t(locale, "common.refresh")}
        </button>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-text-secondary">{t(locale, "common.loading")}</div>
        ) : projects.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-bg-primary px-4 py-6 text-sm text-text-secondary">
            {t(locale, "felinaSettings.savedProjects.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.path}
                className="flex items-center justify-between gap-3 rounded border border-border bg-bg-primary px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={14} className="shrink-0 text-accent" />
                    <span className="truncate font-mono text-xs text-text-primary">
                      {project.path}
                    </span>
                  </div>
                  <div className="mt-1">
                    {project.exists ? (
                      <span className="text-[10px] text-success">
                        {t(locale, "felinaSettings.savedProjects.exists")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-warning">
                        <AlertTriangle size={10} />
                        {t(locale, "felinaSettings.savedProjects.missing")}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded p-1.5 text-text-secondary hover:bg-danger-dim hover:text-danger disabled:opacity-50"
                  onClick={() => setPendingRemove(project)}
                  disabled={removing === project.path}
                  title={t(locale, "felinaSettings.savedProjects.remove")}
                  aria-label={t(locale, "felinaSettings.savedProjects.remove")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        title={t(locale, "felinaSettings.savedProjects.removeConfirmTitle")}
        message={t(locale, "felinaSettings.savedProjects.removeConfirmBody", {
          path: pendingRemove?.path ?? "",
        })}
        confirmLabel={t(locale, "felinaSettings.savedProjects.remove")}
        onconfirm={() => void confirmRemove()}
        oncancel={() => setPendingRemove(null)}
      />
    </section>
  );
}
