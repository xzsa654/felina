import { useState, useEffect } from "react";
import { AlertTriangle, Info, FilePlus, FileEdit, FileX, FileWarning } from "lucide-react";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import type { PullDiffPreview, SiblingResolution, SiblingStatus } from "$lib/types";

interface Props {
  open: boolean;
  skillName: string;
  targetKey: string;
  busy?: boolean;
  diff: PullDiffPreview | null;
  onConfirm: (siblingResolutions: SiblingResolution[]) => void;
  onCancel: () => void;
}

const statusIcon: Record<SiblingStatus, typeof FilePlus> = {
  added: FilePlus,
  modified: FileEdit,
  deleted: FileX,
  conflict: FileWarning,
};

const statusColor: Record<SiblingStatus, string> = {
  added: "text-success",
  modified: "text-info",
  deleted: "text-danger",
  conflict: "text-warning",
};

export default function PullConfirmDialog({
  open,
  skillName,
  targetKey,
  busy = false,
  diff,
  onConfirm,
  onCancel,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);

  const conflicts = diff?.siblingChanges.filter((c) => c.status === "conflict") ?? [];
  const [resolutions, setResolutions] = useState<SiblingResolution[]>([]);

  useEffect(() => {
    setResolutions(conflicts.map(() => "useAgent" as SiblingResolution));
  }, [diff]);

  if (!open) return null;

  const hasDiff = diff && diff.hunks.length > 0;
  const hasSiblings = diff && diff.siblingChanges.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-bg-primary border border-border rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <h2 className="text-sm font-semibold text-text-primary">
            {t(locale, "skills.pull.diffTitle")}
          </h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="text-xs text-text-secondary font-mono bg-bg-secondary rounded px-2 py-1">
            <div>{skillName}</div>
            <div className="text-text-secondary/60">{targetKey}</div>
          </div>

          {diff && !diff.hasBase && (
            <div className="flex items-center gap-1.5 text-xs text-info">
              <Info size={14} className="shrink-0" />
              <span>{t(locale, "skills.pull.noBase")}</span>
            </div>
          )}

          {hasDiff ? (
            <div className="max-h-[40vh] overflow-y-auto rounded border border-border bg-bg-secondary">
              {diff.hunks.map((hunk, hi) => (
                <div key={hi} className="border-b border-border last:border-b-0">
                  <div className="text-[10px] text-text-muted px-2 py-0.5 bg-bg-tertiary font-mono">
                    @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
                  </div>
                  {hunk.lines.map((line, li) => (
                    <div
                      key={li}
                      className={`px-2 font-mono text-xs whitespace-pre-wrap break-all ${
                        line.kind === "delete"
                          ? "bg-danger-dim text-text-primary"
                          : line.kind === "add"
                            ? "bg-success-dim text-text-primary"
                            : "text-text-secondary"
                      }`}
                    >
                      <span className="inline-block w-4 text-text-muted select-none">
                        {line.kind === "delete" ? "−" : line.kind === "add" ? "+" : " "}
                      </span>
                      {line.content.replace(/\n$/, "")}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              {t(locale, "skills.pull.identical")}
            </p>
          )}

          {hasSiblings && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold text-text-primary">
                {t(locale, "skills.pull.siblings.title")}
              </h3>
              <div className="rounded border border-border bg-bg-secondary max-h-[20vh] overflow-y-auto">
                {diff.siblingChanges.map((change, i) => {
                  const Icon = statusIcon[change.status];
                  const color = statusColor[change.status];
                  const conflictIdx = change.status === "conflict"
                    ? diff.siblingChanges.slice(0, i).filter((c) => c.status === "conflict").length
                    : -1;

                  return (
                    <div
                      key={change.path}
                      className="flex items-center gap-2 px-2 py-1 text-xs border-b border-border last:border-b-0"
                    >
                      <Icon size={14} className={`shrink-0 ${color}`} />
                      <span className="font-mono text-text-primary flex-1 truncate">
                        {change.path}
                      </span>
                      <span className={`text-[10px] font-medium ${color}`}>
                        {t(locale, `skills.pull.siblings.${change.status}`)}
                      </span>
                      {change.status === "conflict" && conflictIdx >= 0 && (
                        <select
                          className="text-[10px] bg-bg-tertiary border border-border rounded px-1 py-0.5 text-text-primary"
                          value={resolutions[conflictIdx] ?? "useAgent"}
                          onChange={(e) => {
                            const next = [...resolutions];
                            next[conflictIdx] = e.target.value as SiblingResolution;
                            setResolutions(next);
                          }}
                        >
                          <option value="useAgent">{t(locale, "skills.pull.siblings.resolutionUseAgent")}</option>
                          <option value="useCanonical">{t(locale, "skills.pull.siblings.resolutionUseCanonical")}</option>
                          <option value="skip">{t(locale, "skills.pull.siblings.resolutionSkip")}</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            {t(locale, "skills.editor.cancel")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(resolutions)}
            className="px-3 py-1.5 text-xs rounded bg-warning text-white hover:bg-warning/90 disabled:opacity-50"
          >
            {busy ? "…" : t(locale, "skills.pull.button")}
          </button>
        </div>
      </div>
    </div>
  );
}
