import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import ProjectPicker from "$lib/components/shared/ProjectPicker";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import { PageBody, PageHeader } from "$lib/components/shared/PageScaffold";
import { useProjectContextStore } from "$lib/stores/project-context";
import { useSkillsStore } from "$lib/stores/skills-store";
import { api } from "$lib/tauri/commands";
import type { CanonicalSkill, SkillScope, SkillTarget } from "$lib/types";
import SkillList from "./SkillList";
import SkillEditor from "./SkillEditor";
import PendingPushBar from "./PendingPushBar";
import SkillImportBanner from "./SkillImportBanner";
import SkillImportWizard from "./SkillImportWizard";
import TargetEditor from "./TargetEditor";

/**
 * Skills page — composes the multi-agent-skills-foundation pieces:
 *
 *   ┌─ scope toggle ─┬─ refresh / new / restore-banner ─┐
 *   │ SkillImportBanner (conditional)                   │
 *   │ PendingPushBar    (conditional)                   │
 *   ├─────────────────┬───────────────────────────────────┤
 *   │ SkillList       │ SkillEditor (or empty state)     │
 *   └─────────────────┴───────────────────────────────────┘
 */
export default function SkillsPage() {
  const projectPath = useProjectContextStore((s) => s.selectedProjectPath);
  const {
    scope,
    entries,
    loaded,
    error,
    bannerDismissed,
    detectedImportCount,
    setScope,
    setProjectPath,
    loadEntries,
    refreshImportCount,
    resetBannerDismissed,
    removeEntry,
  } = useSkillsStore();

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<CanonicalSkill | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingTargets, setPendingTargets] = useState<SkillTarget[]>([]);

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

  // Initial load + reload when scope/project changes.
  useEffect(() => {
    void loadEntries();
    void refreshImportCount();
  }, [loadEntries, refreshImportCount, scope, projectPath]);

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
        const skill = await api.canonicalSkills.read(
          scope,
          selectedName,
          projectPath ?? undefined,
        );
        if (!cancelled) setActiveSkill(skill);
      } catch {
        if (!cancelled) setActiveSkill(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedName, scope, projectPath]);

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
      await api.canonicalSkills.delete(scope, name, projectPath ?? undefined);
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
            <ScopeToggle value={scope} onChange={setScope} />
            {scope === "project" && <ProjectPicker />}
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

        {selectedSkill && selectedSkill.targets.length > 0 && (
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
                return (
                  <li
                    key={`${key}-${i}`}
                    className="grid grid-cols-[1rem_5rem_4rem_1fr] gap-3 items-center"
                  >
                    <span
                      className={
                        entry ? "text-emerald-400" : "text-text-secondary"
                      }
                    >
                      {entry ? "✓" : "—"}
                    </span>
                    <span className="capitalize">{t.agent}</span>
                    <span className="text-text-secondary">{t.scope}</span>
                    <span className="text-text-secondary">
                      {entry ? formatLocalTime(entry.at) : "Not synced"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
                    scope={scope}
                    projectPath={projectPath ?? null}
                    targets={pendingTargets}
                    onTargetsChange={setPendingTargets}
                  />
                </div>
                <SkillEditor
                  skill={null}
                  scope={scope}
                  projectPath={projectPath ?? null}
                  onSaved={async (name) => {
                    if (pendingTargets.length > 0) {
                      await api.skillTargets.set(scope, name, pendingTargets, projectPath ?? undefined);
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
                    scope={scope}
                    projectPath={projectPath ?? null}
                    targets={selectedSkill?.targets ?? activeSkill.targets}
                  />
                </div>
                <SkillEditor
                  skill={activeSkill}
                  scope={scope}
                  projectPath={projectPath ?? null}
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
        </div>
      </PageBody>

      {wizardOpen && (
        <SkillImportWizard
          scope={scope}
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

function ScopeToggle({
  value,
  onChange,
}: {
  value: SkillScope;
  onChange: (v: SkillScope) => void;
}) {
  return (
    <div className="inline-flex rounded border border-border overflow-hidden text-xs">
      {(["global", "project"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1 ${
            value === opt
              ? "bg-accent text-white"
              : "bg-bg-primary text-text-secondary hover:text-text-primary"
          }`}
        >
          {opt === "global" ? "Global" : "Project"}
        </button>
      ))}
    </div>
  );
}
