import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Eye, FolderOpen, Plus, Search, Trash2, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { KnownProject, OrphanFile, SkillTarget } from "$lib/types";
import { api } from "$lib/tauri/commands";
import { openPath } from "$lib/tauri/shell";
import { useSkillsStore } from "$lib/stores/skills-store";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { isProjectMissing, normalizeProjectPath } from "$lib/utils/path";
import ConfirmDialog from "$lib/components/shared/ConfirmDialog";
import AddTargetDialog from "./AddTargetDialog";
import type { TargetRemovalPolicy } from "$lib/types";

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

function targetKey(target: SkillTarget): string {
  if (target.scope === "global") return `${target.agent}:global`;
  return `${target.agent}:project:${target.project ?? ""}`;
}

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
  const [pendingRemove, setPendingRemove] = useState<SkillTarget | null>(null);
  const [removing, setRemoving] = useState(false);
  const [contentModal, setContentModal] = useState<{
    target: SkillTarget;
    content: string | null;
    error: string | null;
    loading: boolean;
  } | null>(null);
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<SkillTarget[] | null>(null);

  const flushSave = useCallback(async (targets: SkillTarget[]) => {
    await api.skillTargets.set(skillName, targets);
    await loadEntries();
  }, [skillName, loadEntries]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pendingRef.current) void flushSave(pendingRef.current);
    };
  }, [flushSave]);

  function save(next: SkillTarget[]) {
    if (buffered) {
      onTargetsChange!(next);
      return;
    }
    pendingRef.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const payload = pendingRef.current;
      pendingRef.current = null;
      if (payload) void flushSave(payload);
    }, 300);
  }

  function handleStateChange(idx: number, state: UIState) {
    const next = targets.map((t, i) => (i === idx ? applyUIState(t, state) : t));
    void save(next);
  }

  function handleRemove(idx: number) {
    if (buffered) {
      const next = targets.filter((_, i) => i !== idx);
      void save(next);
      return;
    }
    setPendingRemove(targets[idx]);
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

  async function handleRemovePolicy(policy: TargetRemovalPolicy) {
    const target = pendingRemove;
    if (!target) return;
    setRemoving(true);
    try {
      const result = await api.skillTargets.remove(skillName, target, policy);
      if (!result.targetRemoved && result.deleteResult && !result.deleteResult.success) {
        setPruneMessage(
          t(locale, "skills.targets.removeFailed", {
            error: result.deleteResult.error ?? result.deleteResult.path,
          }),
        );
        setTimeout(() => setPruneMessage(null), 5000);
      }
      setPendingRemove(null);
      await loadEntries();
    } catch (e) {
      setPruneMessage(t(locale, "skills.targets.removeFailed", { error: String(e) }));
      setTimeout(() => setPruneMessage(null), 5000);
    } finally {
      setRemoving(false);
    }
  }

  async function handleRepoint(target: SkillTarget) {
    const dir = await open({ directory: true });
    if (!dir) return;
    try {
      await api.skillTargets.repoint(skillName, target, normalizeProjectPath(dir));
      await loadEntries();
    } catch (e) {
      setPruneMessage(t(locale, "skills.targets.repointFailed", { error: String(e) }));
      setTimeout(() => setPruneMessage(null), 5000);
    }
  }

  async function handleReadContent(target: SkillTarget) {
    setContentModal({ target, content: null, error: null, loading: true });
    try {
      const content = await api.skillTargets.readContent(skillName, targetKey(target));
      setContentModal({ target, content, error: null, loading: false });
    } catch (e) {
      setContentModal({ target, content: null, error: String(e), loading: false });
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
                <span className="text-text-secondary w-14">{tgt.scope === "project" ? t(locale, "skills.addTargetDialog.scopeProject") : t(locale, "skills.addTargetDialog.scopeGlobal")}</span>
                {tgt.scope === "project" && (
                  <span className="text-text-secondary truncate max-w-[10rem]" title={tgt.project ?? ""}>
                    {tgt.project ?? ""}
                  </span>
                )}
                {projectNotFound && (
                  <span
                    className="inline-flex items-center gap-1 text-danger shrink-0"
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
                    <>
                    {projectNotFound && (
                      <button
                        type="button"
                        onClick={() => void handleRepoint(tgt)}
                        className="px-2 py-1 text-[11px] rounded border border-warning/30 text-warning hover:bg-warning-dim"
                        title={t(locale, "skills.targets.repointTitle")}
                      >
                        {t(locale, "skills.targets.repoint")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleReadContent(tgt)}
                      className="p-1 text-text-secondary hover:text-text-primary"
                      title={t(locale, "skills.targets.viewContent")}
                    >
                      <Eye size={12} />
                    </button>
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
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    className="p-1 text-text-secondary hover:text-danger"
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
      <TargetRemovalDialog
        open={pendingRemove !== null}
        target={pendingRemove}
        busy={removing}
        onchoose={(policy) => void handleRemovePolicy(policy)}
        oncancel={() => setPendingRemove(null)}
      />
      <TargetContentModal
        state={contentModal}
        onclose={() => setContentModal(null)}
      />
    </div>
  );
}

function TargetContentModal({
  state,
  onclose,
}: {
  state: {
    target: SkillTarget;
    content: string | null;
    error: string | null;
    loading: boolean;
  } | null;
  onclose: () => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  if (!state) return null;
  const label =
    state.target.scope === "project"
      ? `${state.target.agent}: ${state.target.project ?? ""}`
      : `${state.target.agent}: ~/.felina`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onclose}
        aria-label={t(locale, "skills.targets.contentClose")}
      />
      <div className="relative z-10 flex max-h-[80vh] w-[42rem] max-w-[calc(100vw-2rem)] flex-col rounded border border-border bg-bg-secondary shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">
              {t(locale, "skills.targets.contentTitle", { target: label })}
            </h3>
          </div>
          <button
            type="button"
            onClick={onclose}
            className="p-1 text-text-secondary hover:text-text-primary"
            title={t(locale, "skills.targets.contentClose")}
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {state.loading && (
            <div className="text-sm text-text-secondary">
              {t(locale, "skills.targets.contentLoading")}
            </div>
          )}
          {state.error && (
            <div className="rounded border border-danger/30 bg-danger-dim p-3 text-xs text-danger">
              {t(locale, "skills.targets.contentFailed", { error: state.error })}
            </div>
          )}
          {state.content !== null && (
            <pre className="whitespace-pre-wrap rounded border border-border bg-bg-primary p-3 font-mono text-xs text-text-primary">
              {state.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function TargetRemovalDialog({
  open,
  target,
  busy,
  onchoose,
  oncancel,
}: {
  open: boolean;
  target: SkillTarget | null;
  busy: boolean;
  onchoose: (policy: TargetRemovalPolicy) => void;
  oncancel: () => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  if (!open || !target) return null;
  const label =
    target.scope === "project"
      ? `${target.agent}: ${target.project ?? ""}`
      : `${target.agent}: ~/.felina`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={oncancel}
        aria-label={t(locale, "skills.targets.removeCancel")}
      />
      <div className="relative bg-bg-secondary border border-border rounded shadow-2xl w-[32rem] max-w-[calc(100vw-2rem)] p-5 space-y-4 z-10">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            {t(locale, "skills.targets.removeTitle")}
          </h3>
          <p className="text-sm text-text-muted mt-1">
            {t(locale, "skills.targets.removeMessage", { target: label })}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onchoose("removeTargetOnly")}
            className="rounded border border-border bg-bg-tertiary px-3 py-2 text-xs text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            {t(locale, "skills.targets.removeOnly")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onchoose("removeTargetAndDeleteFile")}
            className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger hover:bg-danger/20 disabled:opacity-50"
          >
            {t(locale, "skills.targets.removeAndDelete")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onchoose("cancel")}
            className="rounded border border-border bg-bg-tertiary px-3 py-2 text-xs text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            {t(locale, "skills.targets.removeCancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
