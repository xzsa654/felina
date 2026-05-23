import { useCallback, useEffect, useMemo, useState } from "react";
import { Grid2x2, List, Loader2, Plus, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { PageBody, PageHeader } from "$lib/components/shared/PageScaffold";
import { useProjectContextStore } from "$lib/stores/project-context";
import { useSkillsStore } from "$lib/stores/skills-store";
import { api } from "$lib/tauri/commands";
import type { CanonicalSkill, KnownProject, SkillTarget } from "$lib/types";
import SkillList from "./SkillList";
import SkillEditor from "./SkillEditor";
import PendingPushBar from "./PendingPushBar";
import SkillImportBanner from "./SkillImportBanner";
import SkillImportWizard from "./SkillImportWizard";
import TargetEditor from "./TargetEditor";
import CoverageMatrix from "./CoverageMatrix";
import { isProjectMissing } from "$lib/utils/path";

/**
 * Skills page — manages the single global canonical skill list and its
 * fan-out targets. After `scope-model-simplification`, canonical lives
 * exclusively under `~/.felina/skills/`; the project-scoped canonical
 * concept and the in-page Global/Project toggle were removed. Per-project
 * managed-inventory views moved to the top-level Projects page.
 *
 *   ┌─ view-mode toggle ─┬─ project picker / reload / new ─┐
 *   │ SkillImportBanner (conditional)                       │
 *   │ PendingPushBar    (conditional)                       │
 *   ├──────────────────────┬─────────────────────────────────┤
 *   │ SkillList            │ SkillEditor (or empty state)   │
 *   └──────────────────────┴─────────────────────────────────┘
 */
export default function SkillsPage() {
  const projectPath = useProjectContextStore((s) => s.selectedProjectPath);
  const {
    entries,
    loaded,
    error,
    bannerDismissed,
    detectedImportCount,
    setProjectPath,
    loadEntries,
    refreshImportCount,
    resetBannerDismissed,
    removeEntry,
  } = useSkillsStore();

  const [viewMode, setViewMode] = useState<"list" | "summary">("list");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<CanonicalSkill | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingTargets, setPendingTargets] = useState<SkillTarget[]>([]);
  const [knownProjects, setKnownProjects] = useState<KnownProject[]>([]);

  // Reload the Known Projects list (each entry carries a backend `exists`
  // stat). Reused by the entries-driven effect and the window-focus listener.
  const refreshKnownProjects = useCallback(() => {
    void api.knownProjects
      .list(projectPath ?? undefined)
      .then(setKnownProjects)
      .catch(() => setKnownProjects([]));
  }, [projectPath]);

  async function handleReload() {
    setReloading(true);
    try {
      await Promise.all([loadEntries(), refreshImportCount()]);
    } finally {
      // Brief residual delay so users see the spinner spin at least once,
      // even when the underlying calls return in <50ms.
      setTimeout(() => setReloading(false), 250);
    }
  }

  // Push the project path into the store whenever it changes upstream.
  useEffect(() => {
    setProjectPath(projectPath ?? null);
  }, [projectPath, setProjectPath]);

  // Initial load + reload when the import-scan project hint changes. The
  // canonical list itself is global and project-independent, but the import
  // banner count scans the selected project's agent dirs.
  useEffect(() => {
    void loadEntries();
    void refreshImportCount();
  }, [loadEntries, refreshImportCount, projectPath]);

  // Known Projects list backs the "project not found" degradation check. Each
  // entry's `exists` flag is a filesystem-stat snapshot, so we refresh it at
  // the moments disk state may have changed: after entries change (a
  // Browse-added L3 target, or a push), and — because folder rename/delete
  // happens OUTSIDE the app — when the window regains focus.
  useEffect(() => {
    refreshKnownProjects();
  }, [refreshKnownProjects, entries]);

  useEffect(() => {
    const onFocus = () => refreshKnownProjects();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshKnownProjects();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshKnownProjects]);

  // When the selected name changes, fetch the full skill (list entries
  // already include the data we need, but read keeps the path canonical).
  useEffect(() => {
    if (!selectedName) {
      setActiveSkill(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const skill = await api.canonicalSkills.read(selectedName);
        if (!cancelled) setActiveSkill(skill);
      } catch {
        if (!cancelled) setActiveSkill(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedName]);

  const isCanonicalEmpty = useMemo(() => {
    return entries.filter((e) => e.kind === "ok").length === 0;
  }, [entries]);

  // Sync info source: the selected skill's targets + lastSync from the live
  // entries list. Refreshes automatically after push (syncAll calls loadEntries).
  const selectedSkill = useMemo(() => {
    if (!selectedName) return null;
    const e = entries.find(
      (x) => x.kind === "ok" && x.skill.name === selectedName,
    );
    return e?.kind === "ok" ? e.skill : null;
  }, [entries, selectedName]);

  const showBanner =
    !bannerDismissed && detectedImportCount > 0 && isCanonicalEmpty;


  function handleDelete() {
    if (!selectedName) return;
    setPendingDelete(selectedName);
  }

  async function confirmDelete() {
    const name = pendingDelete;
    if (!name) return;
    setPendingDelete(null);
    try {
      await api.canonicalSkills.delete(name);
      removeEntry(name);
      setSelectedName((cur) => (cur === name ? null : cur));
      setActiveSkill((cur) => (cur?.name === name ? null : cur));
    } catch (e) {
      window.alert(`Delete failed: ${e}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Skills"
        subtitle="Canonical multi-agent skill manager."
        icon={Sparkles}
        actions={
          <>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <ProjectPicker />
            {bannerDismissed && (
              <button
                type="button"
                onClick={resetBannerDismissed}
                title="Show import banner again"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary"
              >
                <Undo2 size={12} /> Banner
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleReload()}
              disabled={reloading}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-60"
            >
              {reloading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {reloading ? "Reloading…" : "Reload"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingTargets([]);
                setCreatingNew(true);
                setSelectedName(null);
              }}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-accent text-white hover:bg-accent-hover"
            >
              <Plus size={12} /> New skill
            </button>
          </>
        }
      />
      <PageBody>
        <div className="h-full flex flex-col min-h-0">
        {showBanner && <SkillImportBanner onImport={() => setWizardOpen(true)} />}
        <PendingPushBar />

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {viewMode === "list" && selectedSkill && selectedSkill.targets.length > 0 && (
          <div className="mb-4 text-xs rounded border border-border bg-bg-secondary px-3 py-2">
            <div className="text-text-secondary mb-1.5">
              Sync info:{" "}
              <span className="text-text-primary font-mono">
                {selectedSkill.name}
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {selectedSkill.targets.map((t, i) => {
                const key =
                  t.scope === "global"
                    ? `${t.agent}:global`
                    : `${t.agent}:project:${t.project ?? ""}`;
                const entry = selectedSkill.lastSync[key];
                const projectNotFound =
                  t.scope === "project" &&
                  isProjectMissing(knownProjects, t.project ?? "");
                return (
                  <li
                    key={`${key}-${i}`}
                    className="grid grid-cols-[1rem_5rem_4rem_1fr] gap-3 items-center"
                  >
                    <span
                      className={
                        projectNotFound
                          ? "text-red-400"
                          : entry
                            ? "text-emerald-400"
                            : "text-text-secondary"
                      }
                    >
                      {projectNotFound ? "!" : entry ? "✓" : "—"}
                    </span>
                    <span className="capitalize">{t.agent}</span>
                    <span className="text-text-secondary">{t.scope}</span>
                    <span
                      className={
                        projectNotFound ? "text-red-400" : "text-text-secondary"
                      }
                    >
                      {projectNotFound
                        ? "project not found"
                        : entry
                          ? formatLocalTime(entry.at)
                          : "Not synced"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {viewMode === "summary" ? (
          <div className="flex-1 min-h-0 border border-border rounded overflow-auto">
            <CoverageMatrix entries={entries} knownProjects={knownProjects} />
          </div>
        ) : (
          <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4 flex-1 min-h-0">
            <div className="border border-border rounded overflow-y-auto">
              {loaded ? (
                <SkillList
                  entries={entries}
                  selectedName={selectedName}
                  onSelect={(n) => {
                    setCreatingNew(false);
                    setSelectedName(n);
                  }}
                />
              ) : (
                <div className="text-sm text-text-secondary p-4">Loading…</div>
              )}
            </div>

            <div className="border border-border rounded overflow-y-auto">
              {creatingNew ? (
                <div className="flex flex-col">
                  <div className="px-4 pt-4">
                    <TargetEditor
                      skillName=""
                      projectPath={projectPath ?? null}
                      targets={pendingTargets}
                      onTargetsChange={setPendingTargets}
                      knownProjects={knownProjects}
                    />
                  </div>
                  <SkillEditor
                    skill={null}
                    onSaved={async (name) => {
                      if (pendingTargets.length > 0) {
                        await api.skillTargets.set(name, pendingTargets);
                        await loadEntries();
                      }
                      setPendingTargets([]);
                      setCreatingNew(false);
                      setSelectedName(name);
                    }}
                    onCancel={() => {
                      setPendingTargets([]);
                      setCreatingNew(false);
                    }}
                  />
                </div>
              ) : activeSkill ? (
                <div className="flex flex-col">
                  <div className="px-4 pt-4">
                    <TargetEditor
                      skillName={activeSkill.name}
                      projectPath={projectPath ?? null}
                      targets={selectedSkill?.targets ?? activeSkill.targets}
                      knownProjects={knownProjects}
                    />
                  </div>
                  <SkillEditor
                    skill={activeSkill}
                    onSaved={() => {
                      void loadEntries();
                    }}
                    onDelete={handleDelete}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-text-secondary p-8">
                  Select a skill or create a new one.
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </PageBody>

      {wizardOpen && (
        <SkillImportWizard
          projectPath={projectPath ?? null}
          onClose={() => setWizardOpen(false)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete canonical skill"
        message={
          pendingDelete
            ? `"${pendingDelete}" will be removed from canonical storage. Existing agent-side copies (e.g. .claude/skills/, .agents/skills/) are NOT touched.`
            : ""
        }
        confirmLabel="Delete"
        onconfirm={confirmDelete}
        oncancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/**
 * Format a UTC ISO-8601 timestamp into the user's local timezone.
 * Output: `YYYY-MM-DD HH:MM` (24h, no seconds — push cadence is human-scale).
 */
function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: "list" | "summary";
  onChange: (v: "list" | "summary") => void;
}) {
  const items = [
    { id: "list" as const, icon: List, title: "List view" },
    { id: "summary" as const, icon: Grid2x2, title: "Summary view" },
  ];
  return (
    <div className="inline-flex rounded border border-border overflow-hidden text-xs">
      {items.map(({ id, icon: Icon, title }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          title={title}
          className={`px-2 py-1 ${
            value === id
              ? "bg-accent text-white"
              : "bg-bg-primary text-text-secondary hover:text-text-primary"
          }`}
        >
          <Icon size={12} />
        </button>
      ))}
    </div>
  );
}
