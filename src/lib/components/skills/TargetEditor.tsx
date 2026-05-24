import { useEffect, useState } from "react";
import { AlertTriangle, FolderOpen, Plus, Search, Trash2 } from "lucide-react";
import type { KnownProject, OrphanFile, SkillTarget } from "$lib/types";
import { api } from "$lib/tauri/commands";
import { openPath } from "$lib/tauri/shell";
import { useSkillsStore } from "$lib/stores/skills-store";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
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

const STATE_KEYS: Record<UIState, "skills.targets.tracked" | "skills.targets.disabled"> = {
  tracked: "skills.targets.tracked",
  disabled: "skills.targets.disabled",
};

const STATES: UIState[] = ["tracked", "disabled"];

interface Props {
  skillName: string;
  /** Default project path for new project-scope targets added via the dialog. */
  projectPath: string | null;
  targets: SkillTarget[];
  /** When set, targets are buffered locally instead of saved to backend. */
  onTargetsChange?: (targets: SkillTarget[]) => void;
  /** Known Projects (with `exists`) — drives the per-row "project not found"
   *  indicator for project-scope targets whose destination folder is gone. */
  knownProjects?: KnownProject[];
}

export default function TargetEditor({ skillName, projectPath, targets, onTargetsChange, knownProjects }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const loadEntries = useSkillsStore((s) => s.loadEntries);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pruneOrphans, setPruneOrphans] = useState<OrphanFile[] | null>(null);
  const [pruneMessage, setPruneMessage] = useState<string | null>(null);
  // Resolved fan-out destination (`<target>/<canonical-id>/`) + on-disk
  // existence per target row, keyed by agent-scope-project. Drives the per-row
  // "Open target folder" button (disabled until a push creates the folder).
  const [dirInfo, setDirInfo] = useState<Record<string, { path: string; exists: boolean }>>({});

  const buffered = !!onTargetsChange;

  // A buffered editor (new, unsaved skill) has no canonical directory yet, so
  // there is nothing to open; skip resolution entirely.
  useEffect(() => {
    if (buffered || !skillName) {
      setDirInfo({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const resolved = await Promise.all(
        targets.map(async (tgt) => {
          const key = `${tgt.agent}-${tgt.scope}-${tgt.project ?? ""}`;
          try {
            const info = await api.skillSync.resolveTargetDir(
              skillName,
              tgt.agent,
              tgt.scope,
              tgt.project ?? null,
            );
            return [key, info] as const;
          } catch {
            return [key, { path: "", exists: false }] as const;
          }
        }),
      );
      if (!cancelled) setDirInfo(Object.fromEntries(resolved));
    })();
    return () => {
      cancelled = true;
    };
  }, [skillName, targets, buffered]);

  async function save(next: SkillTarget[]) {
    if (buffered) {
      onTargetsChange!(next);
      return;
    }
    await api.skillTargets.set(skillName, next);
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
      const orphans = await api.skillPrune.scan(skillName);
      if (orphans.length === 0) {
        setPruneMessage(t(locale, "skills.targets.noOrphans"));
        setTimeout(() => setPruneMessage(null), 2000);
      } else {
        setPruneOrphans(orphans);
      }
    } catch (e) {
      setPruneMessage(t(locale, "skills.targets.scanFailed", { error: String(e) }));
      setTimeout(() => setPruneMessage(null), 3000);
    }
  }

  async function handlePruneConfirm() {
    if (!pruneOrphans) return;
    const confirmed = [...pruneOrphans];
    setPruneOrphans(null);
    try {
      await api.skillPrune.apply(skillName, confirmed);
      await loadEntries();
    } catch (e) {
      setPruneMessage(t(locale, "skills.targets.pruneFailed", { error: String(e) }));
      setTimeout(() => setPruneMessage(null), 3000);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {t(locale, "skills.targets.title")}
        </h4>
        <div className="flex items-center gap-1">
          {!buffered && (
            <button
              type="button"
              onClick={() => void handlePruneScan()}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent"
            >
              <Search size={12} /> {t(locale, "skills.targets.pruneOrphans")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent"
          >
            <Plus size={12} /> {t(locale, "skills.targets.addTarget")}
          </button>
        </div>
      </div>

      {pruneMessage && (
        <div className="text-xs text-text-secondary italic">{pruneMessage}</div>
      )}

      {targets.length === 0 ? (
        <div className="text-xs text-text-secondary italic py-3 text-center border border-dashed border-border rounded">
          {t(locale, "skills.targets.empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {targets.map((tgt, i) => {
            const current = toUIState(tgt);
            const rowKey = `${tgt.agent}-${tgt.scope}-${tgt.project ?? ""}`;
            const dest = dirInfo[rowKey];
            const projectNotFound =
              tgt.scope === "project" &&
              knownProjects !== undefined &&
              isProjectMissing(knownProjects, tgt.project ?? "");
            return (
              <div
                key={`${tgt.agent}-${tgt.scope}-${tgt.project ?? ""}-${i}`}
                className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1.5"
              >
                <span className="capitalize font-medium w-20">{tgt.agent}</span>
                <span className="text-text-secondary w-14">{tgt.scope}</span>
                {tgt.scope === "project" && (
                  <span className="text-text-secondary truncate max-w-[10rem]" title={tgt.project ?? ""}>
                    {tgt.project ?? ""}
                  </span>
                )}
                {projectNotFound && (
                  <span
                    className="inline-flex items-center gap-1 text-red-400 shrink-0"
                    title={t(locale, "skills.targets.projectNotFoundTooltip")}
                  >
                    <AlertTriangle size={12} /> {t(locale, "skills.projectNotFound")}
                  </span>
                )}

                <div className="ml-auto flex items-center gap-0.5">
                  <div className="inline-flex rounded border border-border overflow-hidden">
                    {STATES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStateChange(i, s)}
                        className={`px-2 py-0.5 text-[11px] ${
                          current === s
                            ? "bg-accent text-white"
                            : "bg-bg-primary text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {t(locale, STATE_KEYS[s])}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled
                      className="px-2 py-0.5 text-[11px] bg-bg-primary text-text-secondary opacity-40 cursor-not-allowed"
                      title={t(locale, "skills.targets.detachedTitle")}
                    >
                      {t(locale, "skills.targets.detached")}
                    </button>
                    <button
                      type="button"
                      disabled
                      className="px-2 py-0.5 text-[11px] bg-bg-primary text-text-secondary opacity-40 cursor-not-allowed"
                      title={t(locale, "skills.targets.forkedTitle")}
                    >
                      {t(locale, "skills.targets.forked")}
                    </button>
                  </div>
                  {!buffered && (
                    <button
                      type="button"
                      disabled={!dest?.exists}
                      onClick={() => {
                        if (dest?.exists) {
                          openPath(dest.path).catch((e) => {
                            setPruneMessage(String(e));
                            setTimeout(() => setPruneMessage(null), 5000);
                          });
                        }
                      }}
                      className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        dest?.exists
                          ? t(locale, "skills.targets.openTargetFolder")
                          : t(locale, "skills.targets.openTargetFolderMissing")
                      }
                    >
                      <FolderOpen size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    className="p-1 text-text-secondary hover:text-red-400"
                    title={t(locale, "skills.targets.removeTarget")}
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
          projectPath={projectPath}
          existingTargets={targets}
          onAdd={handleAdd}
          onClose={() => setDialogOpen(false)}
        />
      )}

      <ConfirmDialog
        open={pruneOrphans !== null}
        title={t(locale, "skills.pruneDialog.title")}
        message={
          pruneOrphans
            ? t(locale, "skills.pruneDialog.message", {
                count: pruneOrphans.length,
                paths: pruneOrphans.map((o) => o.path).join("\n"),
              })
            : ""
        }
        confirmLabel={t(locale, "skills.pruneDialog.confirm")}
        onconfirm={() => void handlePruneConfirm()}
        oncancel={() => setPruneOrphans(null)}
      />
    </div>
  );
}
