import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Download, FolderSearch, Grid2x2, List, Loader2, Plus, RefreshCw, Sparkles, Undo2, X } from "lucide-react";
import { PageBody, PageHeader } from "$lib/components/shared/PageScaffold";
import { useProjectContextStore } from "$lib/stores/project-context";
import { useSkillsStore } from "$lib/stores/skills-store";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { api } from "$lib/tauri/commands";
import {
  skillListEntryCanonicalId,
  type CanonicalSkill,
  type CanonicalDeletePolicy,
  type KnownProject,
  type SkillSyncPreview,
  type SkillSyncResolution,
  type SkillTarget,
} from "$lib/types";
import SkillList from "./SkillList";
import SkillEditor from "./SkillEditor";
import PendingPushBar from "./PendingPushBar";
import SkillImportBanner from "./SkillImportBanner";
import SkillImportWizard from "./SkillImportWizard";
import TargetEditor from "./TargetEditor";
import CoverageMatrix from "./CoverageMatrix";
import SyncInfoBar from "./SyncInfoBar";
import SyncPreviewDialog from "./SyncPreviewDialog";
import DeletePolicyDialog from "./DeletePolicyDialog";

import ManagedInventory from "$lib/components/projects/ManagedInventory";

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
  // App-wide current project (no in-page picker). Used only as the default
  // destination when adding a project-scope target in the editor and to drive
  // the "project not found" indicator — NOT as a canonical scope. The
  // canonical list and import scan are global.
  const locale = useLocaleStore((s) => s.locale);
  const projectPath = useProjectContextStore((s) => s.selectedProjectPath);
  const {
    entries,
    loaded,
    error,
    bannerDismissed,
    detectedImportCount,
    driftMap,
    loadEntries,
    refreshImportCount,
    refreshDriftScan,
    resetBannerDismissed,
    removeEntry,
  } = useSkillsStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"list" | "summary">("list");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<CanonicalSkill | null>(null);
  const [brokenRaw, setBrokenRaw] = useState<{ name: string; content: string; path?: string } | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    canonicalId: string;
    label: string;
    targets: SkillTarget[];
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [pendingTargets, setPendingTargets] = useState<SkillTarget[]>([]);
  const [knownProjects, setKnownProjects] = useState<KnownProject[]>([]);
  const [nameAdvisory, setNameAdvisory] = useState<string | null>(null);
  const [pushPreview, setPushPreview] = useState<SkillSyncPreview | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [localPushingNames, setLocalPushingNames] = useState<Set<string>>(new Set());
  const [browseProject, setBrowseProject] = useState<KnownProject | null>(null);
  const [browsePickerOpen, setBrowsePickerOpen] = useState(false);

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
      void refreshDriftScan();
    } finally {
      // Brief residual delay so users see the spinner spin at least once,
      // even when the underlying calls return in <50ms.
      setTimeout(() => setReloading(false), 250);
    }
  }

  // Canonical list + import scan are both global (the store keeps
  // projectPath=null, so the import banner counts global agent-dir skills).
  // Per-project import lives in the Projects view, not here.
  useEffect(() => {
    void loadEntries().then(() => void refreshDriftScan());
    void refreshImportCount();
  }, [loadEntries, refreshImportCount, refreshDriftScan]);

  // Deep-link selection: the Projects view navigates here with
  // `?select=<skill-name>` to open a managed skill for editing. Consume the
  // param once entries are loaded and the skill exists, then clear it so a
  // later manual selection isn't overridden on re-render.
  useEffect(() => {
    const want = searchParams.get("select");
    if (!want || !loaded) return;
    // Match by canonical directory identity (not parsed `frontmatter.name`) so a
    // deep-link survives name-vs-directory drift. Resolve ok or broken entries;
    // the selection effect routes a broken one into raw repair mode.
    const selected = entries.find((e) => skillListEntryCanonicalId(e) === want);
    if (selected) {
      setViewMode("list");
      setCreatingNew(false);
      setSelectedName(skillListEntryCanonicalId(selected));
    }
    const next = new URLSearchParams(searchParams);
    next.delete("select");
    setSearchParams(next, { replace: true });
  }, [searchParams, loaded, entries, setSearchParams]);

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
      if (document.visibilityState === "visible") {
        refreshKnownProjects();
        void refreshDriftScan();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshKnownProjects, refreshDriftScan]);

  // When the selected name changes, fetch the full skill. A broken entry
  // can't parse, so route it into raw repair mode (load the raw SKILL.md);
  // an ok entry loads structured.
  useEffect(() => {
    if (!selectedName) {
      setActiveSkill(null);
      setBrokenRaw(null);
      return;
    }
    const entry = entries.find((e) => skillListEntryCanonicalId(e) === selectedName);
    const isBroken = entry?.kind === "broken";
    let cancelled = false;
    void (async () => {
      if (isBroken) {
        try {
          const content = await api.canonicalSkills.readRaw(selectedName);
          if (!cancelled) {
            setBrokenRaw({
              name: selectedName,
              content,
              path: entry?.kind === "broken" ? entry.path : undefined,
            });
            setActiveSkill(null);
          }
        } catch {
          if (!cancelled) {
            setBrokenRaw(null);
            setActiveSkill(null);
          }
        }
        return;
      }
      try {
        const skill = await api.canonicalSkills.read(selectedName);
        if (!cancelled) {
          setActiveSkill(skill);
          setBrokenRaw(null);
        }
      } catch {
        if (!cancelled) {
          setActiveSkill(null);
          setBrokenRaw(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedName, entries]);

  const isCanonicalEmpty = useMemo(() => {
    return entries.filter((e) => e.kind === "ok").length === 0;
  }, [entries]);

  // Sync info source: the selected skill's targets + lastSync from the live
  // entries list. Refreshes automatically after push (syncAll calls loadEntries).
  const selectedSkill = useMemo(() => {
    if (!selectedName) return null;
    const e = entries.find(
      (x) => x.kind === "ok" && skillListEntryCanonicalId(x) === selectedName,
    );
    return e?.kind === "ok" ? e.skill : null;
  }, [entries, selectedName]);

  const showBanner =
    !bannerDismissed && detectedImportCount > 0 && isCanonicalEmpty;


  function handleDelete() {
    if (!selectedName) return;
    const entry = entries.find((e) => skillListEntryCanonicalId(e) === selectedName);
    setPendingDelete({
      canonicalId: selectedName,
      label: entry?.kind === "ok" ? entry.skill.name : entry?.name ?? selectedName,
      targets: entry?.kind === "ok" ? entry.skill.targets : [],
    });
  }

  async function confirmDelete(policy: CanonicalDeletePolicy) {
    const pending = pendingDelete;
    if (!pending) return;
    setDeleteBusy(true);
    try {
      await api.canonicalSkills.deleteWithPolicy(pending.canonicalId, policy);
      removeEntry(pending.canonicalId);
      setSelectedName((cur) => (cur === pending.canonicalId ? null : cur));
      setActiveSkill((cur) => (cur?.canonicalId === pending.canonicalId ? null : cur));
      setBrokenRaw((cur) => (cur?.name === pending.canonicalId ? null : cur));
      setPendingDelete(null);
    } catch (e) {
      window.alert(t(locale, "skills.deleteDialog.failed", { error: String(e) }));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handlePushOne(canonicalId: string) {
    setLocalPushingNames((current) => new Set(current).add(canonicalId));
    try {
      const preview = await api.skillSync.preview(canonicalId);
      setPushPreview(preview);
    } catch (e) {
      window.alert(String(e));
    } finally {
      setLocalPushingNames((current) => {
        const next = new Set(current);
        next.delete(canonicalId);
        return next;
      });
    }
  }

  async function confirmPushOne(resolutionsBySkill: Record<string, SkillSyncResolution[]>) {
    const preview = pushPreview;
    if (!preview) return;
    setPushBusy(true);
    try {
      await api.skillSync.commit({
        skillName: preview.skillName,
        resolutions: resolutionsBySkill[preview.skillName] ?? [],
      });
      await loadEntries();
      void refreshDriftScan();
      setPushPreview(null);
    } catch (e) {
      window.alert(String(e));
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t(locale, "skills.title")}
        subtitle={t(locale, "skills.subtitle")}
        icon={Sparkles}
        actions={
          <>
            <ViewModeToggle value={viewMode} onChange={(v) => { setViewMode(v); if (v === "summary") void refreshDriftScan(); }} locale={locale} />
            {bannerDismissed && (
              <button
                type="button"
                onClick={resetBannerDismissed}
                title={t(locale, "skills.showBanner")}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary"
              >
                <Undo2 size={12} /> {t(locale, "skills.showBanner")}
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
              {reloading ? t(locale, "skills.reloading") : t(locale, "skills.reload")}
            </button>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary"
            >
              <Download size={12} /> {t(locale, "skills.import")}
            </button>
            <button
              type="button"
              onClick={() => {
                refreshKnownProjects();
                setBrowsePickerOpen(true);
              }}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary"
            >
              <FolderSearch size={12} /> {t(locale, "skills.browseProject")}
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
              <Plus size={12} /> {t(locale, "skills.newSkill")}
            </button>
          </>
        }
      />
      <PageBody>
        <div className="h-full flex flex-col min-h-0">
        {showBanner && <SkillImportBanner onImport={() => setWizardOpen(true)} />}
        <PendingPushBar />

        {error && (
          <div className="text-xs text-danger bg-danger-dim border border-danger/30 rounded px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {nameAdvisory && (
          <div className="text-xs text-warning bg-warning-dim border border-warning/30 rounded px-3 py-2 mb-4 flex items-center justify-between">
            <span>{nameAdvisory}</span>
            <button
              type="button"
              onClick={() => setNameAdvisory(null)}
              className="ml-2 text-warning hover:text-warning/80"
            >
              ×
            </button>
          </div>
        )}

        {viewMode === "list" && selectedSkill && selectedSkill.targets.length > 0 && (
          <SyncInfoBar
            key={selectedSkill.name}
            skillName={selectedSkill.name}
            targets={selectedSkill.targets}
            lastSync={selectedSkill.lastSync}
            knownProjects={knownProjects}
            locale={locale}
          />
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
                    setNameAdvisory(null);
                  }}
                  onPush={(name) => void handlePushOne(name)}
                  pushingNames={localPushingNames}
                  driftMap={driftMap}
                />
              ) : (
                <div className="text-sm text-text-secondary p-4">{t(locale, "skills.loading")}</div>
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
              ) : brokenRaw ? (
                <SkillEditor
                  skill={null}
                  brokenRaw={brokenRaw}
                  onSaved={async (name, normalizedFrom) => {
                    if (normalizedFrom) {
                      setNameAdvisory(
                        t(locale, "skills.editor.nameNormalized", {
                          from: normalizedFrom,
                          to: name,
                        }),
                      );
                    }
                    try {
                      const repaired = await api.canonicalSkills.read(name);
                      setActiveSkill(repaired);
                      setBrokenRaw(null);
                      setSelectedName(name);
                    } catch {
                      setBrokenRaw(null);
                      setSelectedName(name);
                    }
                    await loadEntries();
                  }}
                  onDelete={handleDelete}
                />
              ) : activeSkill ? (
                <div className="flex flex-col">
                  <div className="px-4 pt-4">
                    <TargetEditor
                      skillName={activeSkill.canonicalId || activeSkill.name}
                      projectPath={projectPath ?? null}
                      targets={selectedSkill?.targets ?? activeSkill.targets}
                      knownProjects={knownProjects}
                    />
                  </div>
                  <SkillEditor
                    skill={activeSkill}
                    onSaved={(name, normalizedFrom) => {
                      if (normalizedFrom) {
                        setNameAdvisory(
                          t(locale, "skills.editor.nameNormalized", {
                            from: normalizedFrom,
                            to: name,
                          }),
                        );
                      }
                      void loadEntries();
                    }}
                    onDelete={handleDelete}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-text-secondary p-8">
                  {t(locale, "skills.selectOrCreate")}
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

      <DeletePolicyDialog
        open={pendingDelete !== null}
        name={pendingDelete?.label ?? ""}
        targets={pendingDelete?.targets ?? []}
        busy={deleteBusy}
        onchoose={(policy) => void confirmDelete(policy)}
        oncancel={() => setPendingDelete(null)}
      />
      <SyncPreviewDialog
        open={pushPreview !== null}
        previews={pushPreview ? [pushPreview] : []}
        busy={pushBusy}
        onconfirm={(resolutionsBySkill) => void confirmPushOne(resolutionsBySkill)}
        oncancel={() => setPushPreview(null)}
      />

      {browsePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-bg-primary border border-border rounded-lg shadow-xl max-w-md w-full max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">{t(locale, "skills.browseProject")}</h2>
              <button type="button" onClick={() => setBrowsePickerOpen(false)} className="p-1 text-text-secondary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-1">
              {knownProjects.filter((p) => p.exists).length === 0 ? (
                <div className="text-sm text-text-secondary py-4 text-center">
                  {t(locale, "skills.browseProjectEmpty")}
                </div>
              ) : (
                knownProjects.filter((p) => p.exists).map((p) => (
                  <button
                    key={p.path}
                    type="button"
                    onClick={() => {
                      setBrowseProject(p);
                      setBrowsePickerOpen(false);
                    }}
                    className="text-left px-3 py-2 rounded hover:bg-bg-secondary text-sm text-text-primary"
                  >
                    <div className="font-mono text-xs truncate">{p.path}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {browseProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-bg-primary border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{t(locale, "skills.browseProject")}</h2>
                <p className="text-xs text-text-secondary font-mono truncate">{browseProject.path}</p>
              </div>
              <button type="button" onClick={() => setBrowseProject(null)} className="p-1 text-text-secondary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ManagedInventory
                project={browseProject}
                onChanged={() => {
                  void loadEntries();
                  void refreshImportCount();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ViewModeToggle({
  value,
  onChange,
  locale,
}: {
  value: "list" | "summary";
  onChange: (v: "list" | "summary") => void;
  locale: import("$lib/i18n").Locale;
}) {
  const items = [
    { id: "list" as const, icon: List, title: t(locale, "skills.viewMode.list") },
    { id: "summary" as const, icon: Grid2x2, title: t(locale, "skills.viewMode.summary") },
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
