import { AlertTriangle, Info } from "lucide-react";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import type { PullDiffPreview } from "$lib/types";

interface Props {
  open: boolean;
  skillName: string;
  targetKey: string;
  busy?: boolean;
  diff: PullDiffPreview | null;
  onConfirm: () => void;
  onCancel: () => void;
}

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
  if (!open) return null;

  const hasDiff = diff && diff.hunks.length > 0;

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
            <div className="max-h-[60vh] overflow-y-auto rounded border border-border bg-bg-secondary">
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
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded bg-warning text-white hover:bg-warning/90 disabled:opacity-50"
          >
            {busy ? "…" : t(locale, "skills.pull.button")}
          </button>
        </div>
      </div>
    </div>
  );
}
