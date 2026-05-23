import { useState } from "react";
import { AlertTriangle, Plus, Search, Trash2 } from "lucide-react";
import type { KnownProject, OrphanFile, SkillScope, SkillTarget } from "$lib/types";
import { api } from "$lib/tauri/commands";
import { useSkillsStore } from "$lib/stores/skills-store";
import { isProjectMissing } from "$lib/utils/path";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import AddTargetDialog from "./AddTargetDialog";

type UIState = "tracked" | "disabled";

function toUIState(t: SkillTarget): UIState {
  if (!t.enabled) return "disabled";
  if (t.mode === "detached") return "disabled";
  return "tracked";
}

function applyUIState(t: SkillTarget, state: UIState): SkillTarget {
  switch (state) {
    case "tracked":
      return { ...t, enabled: true, mode: "tracked" };
    case "disabled":
      return { ...t, enabled: false, mode: "tracked" };
  }
}

const STATES: { value: UIState; label: string }[] = [
  { value: "tracked", label: "Tracked" },
  { value: "disabled", label: "Disabled" },
];

interface Props {
  skillName: string;
  scope: SkillScope;
  projectPath: string | null;
  targets: SkillTarget[];
  /** When set, targets are buffered locally instead of saved to backend. */
  onTargetsChange?: (targets: SkillTarget[]) => void;
  /** Known Projects (with `exists`) — drives the per-row "project not found"
   *  indicator for project-scope targets whose destination folder is gone. */
  knownProjects?: KnownProject[];
}

export default function TargetEditor({ skillName, scope, projectPath, targets, onTargetsChange, knownProjects }: Props) {
  const loadEntries = useSkillsStore((s) => s.loadEntries);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pruneOrphans, setPruneOrphans] = useState<OrphanFile[] | null>(null);
  const [pruneMessage, setPruneMessage] = useState<string | null>(null);

  const buffered = !!onTargetsChange;

  async function save(next: SkillTarget[]) {
    if (buffered) {
      onTargetsChange!(next);
      return;
    }
    await api.skillTargets.set(scope, skillName, next, projectPath ?? undefined);
    await loadEntries();
  }

  function handleStateChange(idx: number, state: UIState) {
    const next = targets.map((t, i) => (i === idx ? applyUIState(t, state) : t));
    void save(next);
  }

  function handleRemove(idx: number) {
    const next = targets.filter((_, i) => i !== idx);
    void save(next);
  }

  function handleAdd(target: SkillTarget) {
    void save([...targets, target]);
  }

  async function handlePruneScan() {
    try {
      const orphans = await api.skillPrune.scan(scope, skillName, projectPath ?? undefined);
      if (orphans.length === 0) {
        setPruneMessage("No orphans found.");
        setTimeout(() => setPruneMessage(null), 2000);
      } else {
        setPruneOrphans(orphans);
      }
    } catch (e) {
      setPruneMessage(`Scan failed: ${e}`);
      setTimeout(() => setPruneMessage(null), 3000);
    }
  }

  async function handlePruneConfirm() {
    if (!pruneOrphans) return;
    const confirmed = [...pruneOrphans];
    setPruneOrphans(null);
    try {
      await api.skillPrune.apply(scope, skillName, confirmed, projectPath ?? undefined);
      await loadEntries();
    } catch (e) {
      setPruneMessage(`Prune failed: ${e}`);
      setTimeout(() => setPruneMessage(null), 3000);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Targets
        </h4>
        <div className="flex items-center gap-1">
          {!buffered && (
            <button
              type="button"
              onClick={() => void handlePruneScan()}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent"
            >
              <Search size={12} /> Prune orphans
            </button>
          )}
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent"
          >
            <Plus size={12} /> Add target
          </button>
        </div>
      </div>

      {pruneMessage && (
        <div className="text-xs text-text-secondary italic">{pruneMessage}</div>
      )}

      {targets.length === 0 ? (
        <div className="text-xs text-text-secondary italic py-3 text-center border border-dashed border-border rounded">
          No targets yet — add one to push this skill.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {targets.map((t, i) => {
            const current = toUIState(t);
            const projectNotFound =
              t.scope === "project" &&
              knownProjects !== undefined &&
              isProjectMissing(knownProjects, t.project ?? "");
            return (
              <div
                key={`${t.agent}-${t.scope}-${t.project ?? ""}-${i}`}
                className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1.5"
              >
                <span className="capitalize font-medium w-20">{t.agent}</span>
                <span className="text-text-secondary w-14">{t.scope}</span>
                {t.scope === "project" && (
                  <span className="text-text-secondary truncate max-w-[10rem]" title={t.project ?? ""}>
                    {t.project ?? ""}
                  </span>
                )}
                {projectNotFound && (
                  <span
                    className="inline-flex items-center gap-1 text-red-400 shrink-0"
                    title="此 target 的 project 資料夾不存在（已被刪除/改名/卸載）。請還原資料夾，或刪除此 target 後重新指向新路徑。"
                  >
                    <AlertTriangle size={12} /> project not found
                  </span>
                )}

                <div className="ml-auto flex items-center gap-0.5">
                  <div className="inline-flex rounded border border-border overflow-hidden">
                    {STATES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => handleStateChange(i, s.value)}
                        className={`px-2 py-0.5 text-[11px] ${
                          current === s.value
                            ? "bg-accent text-white"
                            : "bg-bg-primary text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled
                      className="px-2 py-0.5 text-[11px] bg-bg-primary text-text-secondary opacity-40 cursor-not-allowed"
                      title="Phase 2: drift detection"
                    >
                      Detached
                    </button>
                    <button
                      type="button"
                      disabled
                      className="px-2 py-0.5 text-[11px] bg-bg-primary text-text-secondary opacity-40 cursor-not-allowed"
                      title="Phase 2: overlay rendering"
                    >
                      Forked
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    className="p-1 text-text-secondary hover:text-red-400"
                    title="Remove target"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <AddTargetDialog
          scope={scope}
          projectPath={projectPath}
          existingTargets={targets}
          onAdd={handleAdd}
          onClose={() => setDialogOpen(false)}
        />
      )}

      <ConfirmDialog
        open={pruneOrphans !== null}
        title="Prune orphan files"
        message={
          pruneOrphans
            ? `Delete ${pruneOrphans.length} orphaned agent-side file(s)?\n\n${pruneOrphans.map((o) => o.path).join("\n")}`
            : ""
        }
        confirmLabel="Delete"
        onconfirm={() => void handlePruneConfirm()}
        oncancel={() => setPruneOrphans(null)}
      />
    </div>
  );
}
