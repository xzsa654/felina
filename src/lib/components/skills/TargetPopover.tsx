import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FolderOpen, Trash2, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { ForkDiffPreview, KnownProject, PullDiffPreview, SkillTarget, TargetRemovalPolicy } from "$lib/types";
import type { LastSyncEntry } from "$lib/types/skills";
import { api } from "$lib/tauri/commands";
import { openPath } from "$lib/tauri/shell";
import { useSkillsStore } from "$lib/stores/skills-store";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import { isProjectMissing, normalizeProjectPath } from "$lib/utils/path";
import { classifyTarget, isTargetDisabled, STATUS_CONFIG, targetKey } from "./sync-status-utils";
import Modal from "$lib/components/shared/Modal";
import PullConfirmDialog from "./PullConfirmDialog";
import ForkPreviewDialog from "./ForkPreviewDialog";

type UIState = "auto" | "manual" | "disabled" | "forked";

function toUIState(tgt: SkillTarget): UIState {
  if (tgt.mode === "forked") return "forked";
  if (isTargetDisabled(tgt)) return "disabled";
  if (tgt.mode === "auto") return "auto";
  return "manual";
}

function applyUIState(tgt: SkillTarget, state: UIState): SkillTarget {
  switch (state) {
    case "auto":
      return { ...tgt, enabled: true, mode: "auto" };
    case "manual":
      return { ...tgt, enabled: true, mode: "manual" };
    case "forked":
      return { ...tgt, enabled: true, mode: "forked" };
    case "disabled":
      return { ...tgt, enabled: false };
  }
}

const STATE_KEYS = {
  auto: "skills.targets.auto",
  manual: "skills.targets.manual",
  disabled: "skills.targets.disabled",
  forked: "skills.targets.forked",
} as const;

function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  skillName: string;
  target: SkillTarget;
  targetIndex: number;
  allTargets: SkillTarget[];
  lastSync: Record<string, LastSyncEntry>;
  knownProjects: KnownProject[];
  anchorRect: DOMRect | null;
  onClose: () => void;
  onTargetsChange?: () => void;
}

export default function TargetPopover({
  skillName,
  target,
  targetIndex,
  allTargets,
  lastSync,
  knownProjects,
  anchorRect,
  onClose,
  onTargetsChange,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const loadEntries = useSkillsStore((s) => s.loadEntries);
  const driftMap = useSkillsStore((s) => s.driftMap);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dirInfo, setDirInfo] = useState<{ path: string; exists: boolean } | null>(null);
  const [pendingRemove, setPendingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [pullTarget, setPullTarget] = useState<{ key: string; name: string } | null>(null);
  const [pullBusy, setPullBusy] = useState(false);
  const [pullDiff, setPullDiff] = useState<PullDiffPreview | null>(null);
  const [pendingUnfork, setPendingUnfork] = useState<UIState | null>(null);
  const [forkPreview, setForkPreview] = useState<ForkDiffPreview | null>(null);
  const [forkPreviewOpen, setForkPreviewOpen] = useState(false);
  const refreshDriftScan = useSkillsStore((s) => s.refreshDriftScan);

  const hasOpenDialog = pendingRemove || pullTarget !== null || pendingUnfork !== null || forkPreviewOpen;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (hasOpenDialog) return;
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (hasOpenDialog) return;
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose, hasOpenDialog]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const info = await api.skillSync.resolveTargetDir(
          skillName,
          target.agent,
          target.scope,
          target.project ?? null,
        );
        if (!cancelled) setDirInfo(info);
      } catch {
        if (!cancelled) setDirInfo({ path: "", exists: false });
      }
    })();
    return () => { cancelled = true; };
  }, [skillName, target]);

  const key = targetKey(target);
  const entry = lastSync[key];
  const status = classifyTarget(target, entry, knownProjects);
  const cfg = STATUS_CONFIG[status];
  const current = toUIState(target);
  const projectNotFound =
    target.scope === "project" &&
    isProjectMissing(knownProjects, target.project ?? "");
  const drifted = driftMap[skillName]?.[key] === "drifted";

  const syncLabel = entry?.at
    ? `${t(locale, "skills.syncInfoBar.synced")} ${formatLocalTime(entry.at)}`
    : t(locale, "skills.notSynced");

  async function handleStateChange(state: UIState) {
    if (current === "forked" && state !== "forked") {
      setPendingUnfork(state);
      return;
    }
    await applyStateChange(state);
  }

  async function applyStateChange(state: UIState) {
    const next = allTargets.map((tgt, i) =>
      i === targetIndex ? applyUIState(tgt, state) : tgt,
    );
    await api.skillTargets.set(skillName, next);
    await loadEntries();
    onTargetsChange?.();
  }

  async function handleRemoveConfirm(policy: TargetRemovalPolicy) {
    if (policy === "cancel") {
      setPendingRemove(false);
      return;
    }
    setRemoving(true);
    try {
      const result = await api.skillTargets.remove(skillName, target, policy);
      if (!result.targetRemoved && result.deleteResult && !result.deleteResult.success) {
        setStatusMessage(
          t(locale, "skills.targets.removeFailed", {
            error: result.deleteResult.error ?? result.deleteResult.path,
          }),
        );
      } else {
        setPendingRemove(false);
        await loadEntries();
        onTargetsChange?.();
        onClose();
      }
    } catch (e) {
      setStatusMessage(t(locale, "skills.targets.removeFailed", { error: String(e) }));
    } finally {
      setRemoving(false);
    }
  }


  async function handleForkPreview() {
    try {
      const diff = await api.skillFork.diffPreview(skillName, key);
      setForkPreview(diff);
      setForkPreviewOpen(true);
    } catch (e) {
      setStatusMessage(String(e));
    }
  }

  async function handlePullPreview() {
    try {
      const diff = await api.skillPull.preview(skillName, key);
      setPullDiff(diff);
      setPullTarget({ key, name: skillName });
    } catch (e) {
      window.alert(t(locale, "skills.pull.failed", { error: String(e) }));
    }
  }

  async function handleRepoint() {
    const dir = await open({ directory: true });
    if (!dir) return;
    try {
      await api.skillTargets.repoint(skillName, target, normalizeProjectPath(dir));
      await loadEntries();
      onTargetsChange?.();
    } catch (e) {
      setStatusMessage(t(locale, "skills.targets.repointFailed", { error: String(e) }));
    }
  }

  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = "fixed";
    style.top = anchorRect.bottom + 4;
    style.left = anchorRect.left;
    style.zIndex = 50;
  }

  return (
    <>
      <div
        ref={popoverRef}
        className="bg-bg-primary border border-border rounded-lg shadow-lg min-w-[300px] max-w-[420px]"
        style={style}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cfg.chipClass.split(" ")[0]}>{cfg.icon}</span>
            <span className="font-medium capitalize">{target.agent}</span>
            <span className="text-text-secondary">·</span>
            <span className="text-text-secondary">{target.scope}</span>
            {target.scope === "project" && target.project && (
              <>
                <span className="text-text-secondary">·</span>
                <span className="text-text-secondary truncate max-w-[120px]" title={target.project}>
                  {target.project.split(/[/\\]/).filter(Boolean).pop() ?? target.project}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 text-text-secondary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>

        {/* Status: disabled OR drift warning OR sync time (in that priority).
            When disabled, sync freshness is meaningless — show the off state. */}
        <div className="px-3 pb-2 flex items-center gap-2 text-xs">
          {current === "forked" ? (
            <>
              <span className={`inline-flex items-center gap-1 ${cfg.chipClass.split(" ")[0]}`}>
                {cfg.icon} {t(locale, "skills.targets.forked")}
              </span>
              <button
                type="button"
                onClick={() => void handleForkPreview()}
                className="text-[11px] px-1.5 py-0.5 rounded border border-info/40 text-info hover:bg-info/10"
              >
                {t(locale, "skills.fork.previewButton")}
              </button>
            </>
          ) : current === "disabled" ? (
            <span className="text-text-secondary">∅ {t(locale, "skills.targets.disabled")}</span>
          ) : drifted ? (
            <>
              <span className="inline-flex items-center gap-1 text-warning">
                <AlertTriangle size={12} /> {t(locale, "skills.drift.drifted")}
              </span>
              <button
                type="button"
                onClick={() => void handlePullPreview()}
                className="text-[11px] px-1.5 py-0.5 rounded border border-warning/40 text-warning hover:bg-warning/10"
              >
                {t(locale, "skills.pull.button")}
              </button>
            </>
          ) : (
            <span className={status === "pending" ? "text-warning" : status === "missing" ? "text-danger" : "text-text-secondary"}>
              {syncLabel}
            </span>
          )}
          {projectNotFound && (
            <span className="inline-flex items-center gap-1 text-danger">
              <AlertTriangle size={12} /> {t(locale, "skills.projectNotFound")}
            </span>
          )}
        </div>

        {/* Mode selector */}
        <div className="px-3 pb-2 flex items-center gap-2 text-xs">
          <span className="text-text-secondary">{t(locale, "skills.targets.title")}:</span>
          <select
            value={current}
            onChange={(e) => void handleStateChange(e.target.value as UIState)}
            className="bg-bg-secondary border border-border rounded px-1.5 py-0.5 text-xs text-text-primary"
          >
            <option value="auto">{t(locale, STATE_KEYS.auto)}</option>
            <option value="manual">{t(locale, STATE_KEYS.manual)}</option>
            <option value="forked">{t(locale, STATE_KEYS.forked)}</option>
            <option value="disabled">{t(locale, STATE_KEYS.disabled)}</option>
          </select>
        </div>

        {statusMessage && (
          <div className="px-3 pb-2 text-xs text-danger">{statusMessage}</div>
        )}

        {/* Actions */}
        <div className="px-3 pb-2 flex items-center gap-1">
          {projectNotFound && (
            <button
              type="button"
              onClick={() => void handleRepoint()}
              className="px-2 py-1 text-[11px] rounded border border-warning/30 text-warning hover:bg-warning-dim"
              title={t(locale, "skills.targets.repointTitle")}
            >
              {t(locale, "skills.targets.repoint")}
            </button>
          )}
          <button
            type="button"
            disabled={!dirInfo?.exists}
            onClick={() => {
              if (dirInfo?.exists) {
                openPath(dirInfo.path).catch((e) => {
                  setStatusMessage(String(e));
                });
              }
            }}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              dirInfo?.exists
                ? t(locale, "skills.targets.openTargetFolder")
                : t(locale, "skills.targets.openTargetFolderMissing")
            }
          >
            <FolderOpen size={14} />
          </button>
          <button
            type="button"
            onClick={() => setPendingRemove(true)}
            className="p-1.5 text-text-secondary hover:text-danger hover:bg-bg-secondary rounded transition-colors"
            title={t(locale, "skills.targets.removeTarget")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Removal confirmation dialog */}
      {pendingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setPendingRemove(false)}
            aria-label={t(locale, "skills.targets.removeCancel")}
          />
          <div className="relative bg-bg-secondary border border-border rounded shadow-2xl w-[32rem] max-w-[calc(100vw-2rem)] p-5 space-y-4 z-10">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                {t(locale, "skills.targets.removeTitle")}
              </h3>
              <p className="text-sm text-text-muted mt-1">
                {t(locale, "skills.targets.removeMessage", {
                  target: target.scope === "project"
                    ? `${target.agent}: ${target.project ?? ""}`
                    : `${target.agent}: ~/.felina`,
                })}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => void handleRemoveConfirm("removeTargetOnly")}
                className="rounded border border-border bg-bg-tertiary px-3 py-2 text-xs text-text-primary hover:bg-bg-hover disabled:opacity-50"
              >
                {t(locale, "skills.targets.removeOnly")}
              </button>
              <button
                type="button"
                disabled={removing || !dirInfo?.exists}
                onClick={() => void handleRemoveConfirm("removeTargetAndDeleteFile")}
                className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger hover:bg-danger/20 disabled:opacity-50"
              >
                {t(locale, "skills.targets.removeAndDelete")}
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void handleRemoveConfirm("cancel")}
                className="rounded border border-border bg-bg-tertiary px-3 py-2 text-xs text-text-primary hover:bg-bg-hover disabled:opacity-50"
              >
                {t(locale, "skills.targets.removeCancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unfork confirmation dialog */}
      <Modal open={pendingUnfork !== null} onClose={() => setPendingUnfork(null)} size="sm">
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              {t(locale, "skills.fork.unforkConfirmTitle")}
            </h3>
            <p className="text-sm text-text-muted mt-1">
              {t(locale, "skills.fork.unforkConfirmBody")}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingUnfork(null)}
              className="rounded border border-border bg-bg-tertiary px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
            >
              {t(locale, "skills.targets.removeCancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                const state = pendingUnfork!;
                setPendingUnfork(null);
                void applyStateChange(state);
              }}
              className="rounded border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger hover:bg-danger/20"
            >
              {pendingUnfork ? t(locale, STATE_KEYS[pendingUnfork]) : ""}
            </button>
          </div>
        </div>
      </Modal>

      {/* Fork preview dialog */}
      <ForkPreviewDialog
        open={forkPreviewOpen}
        skillName={skillName}
        targetKey={key}
        diff={forkPreview}
        onClose={() => { setForkPreviewOpen(false); setForkPreview(null); }}
      />

      {/* Pull confirm dialog */}
      <PullConfirmDialog
        open={pullTarget !== null}
        skillName={pullTarget?.name ?? ""}
        targetKey={pullTarget?.key ?? ""}
        busy={pullBusy}
        diff={pullDiff}
        onConfirm={async (siblingResolutions) => {
          if (!pullTarget) return;
          setPullBusy(true);
          try {
            await api.skillPull.fromTarget(
              pullTarget.name,
              pullTarget.key,
              siblingResolutions.length > 0 ? siblingResolutions : undefined,
            );
            await loadEntries();
            void refreshDriftScan();
            setPullTarget(null);
            setPullDiff(null);
            onTargetsChange?.();
          } catch (e) {
            window.alert(t(locale, "skills.pull.failed", { error: String(e) }));
          } finally {
            setPullBusy(false);
          }
        }}
        onCancel={() => { setPullTarget(null); setPullDiff(null); }}
      />
    </>
  );
}
