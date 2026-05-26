import { AlertTriangle, GitBranch, Trash2, Unlink } from "lucide-react";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";
import type { CanonicalDeletePolicy, SkillTarget } from "$lib/types";

interface Props {
  open: boolean;
  name: string;
  targets: SkillTarget[];
  busy?: boolean;
  onchoose: (policy: CanonicalDeletePolicy) => void;
  oncancel: () => void;
}

export default function DeletePolicyDialog({
  open,
  name,
  targets,
  busy = false,
  onchoose,
  oncancel,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);
  if (!open) return null;

  const cascadeTargets = targets.filter((target) => target.enabled && target.mode === "tracked");
  const canCascade = cascadeTargets.length > 0;
  const preservedCount = targets.length - cascadeTargets.length;
  const targetSummary = cascadeTargets
    .map((target) =>
      target.scope === "project"
        ? `${target.agent}: ${target.project ?? ""}`
        : `${target.agent}: global`,
    )
    .join("\n");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={oncancel}
        aria-label={t(locale, "skills.deleteDialog.cancel")}
      />
      <div className="relative bg-bg-secondary border border-border rounded shadow-2xl w-[34rem] max-w-[calc(100vw-2rem)] p-5 space-y-4 z-10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-text-primary">
              {t(locale, "skills.deleteDialog.title")}
            </h3>
            <p className="text-sm text-text-muted mt-1">
              {t(locale, "skills.deleteDialog.policyMessage", {
                name,
                count: cascadeTargets.length,
              })}
            </p>
            {preservedCount > 0 && (
              <p className="text-xs text-text-secondary mt-1">
                {t(locale, "skills.deleteDialog.preservedMessage", { count: preservedCount })}
              </p>
            )}
          </div>
        </div>

        {cascadeTargets.length > 0 && (
          <pre className="max-h-32 overflow-auto text-xs font-mono text-text-secondary bg-bg-primary border border-border rounded p-2 whitespace-pre-wrap">
            {targetSummary}
          </pre>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={busy || !canCascade}
            onClick={() => onchoose("cascade")}
            title={!canCascade ? t(locale, "skills.deleteDialog.cascadeDisabled") : undefined}
            className="flex flex-col items-center gap-1 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={16} />
            {t(locale, "skills.deleteDialog.cascade")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onchoose("detach")}
            className="flex flex-col items-center gap-1 rounded border border-border bg-bg-tertiary px-3 py-2 text-xs text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            <Unlink size={16} />
            {t(locale, "skills.deleteDialog.detach")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={oncancel}
            className="flex flex-col items-center gap-1 rounded border border-border bg-bg-tertiary px-3 py-2 text-xs text-text-primary hover:bg-bg-hover disabled:opacity-50"
          >
            <GitBranch size={16} />
            {t(locale, "skills.deleteDialog.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
