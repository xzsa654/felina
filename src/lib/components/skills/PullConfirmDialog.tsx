import { AlertTriangle } from "lucide-react";
import { useLocaleStore } from "$lib/stores/locale";
import { t } from "$lib/i18n";

interface Props {
  open: boolean;
  skillName: string;
  targetKey: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PullConfirmDialog({
  open,
  skillName,
  targetKey,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const locale = useLocaleStore((s) => s.locale);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-bg-primary border border-border rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <h2 className="text-sm font-semibold text-text-primary">
            {t(locale, "skills.pull.confirmTitle")}
          </h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            {t(locale, "skills.pull.confirmMessage")}
          </p>
          <div className="text-xs text-text-secondary font-mono bg-bg-secondary rounded px-2 py-1">
            <div>{skillName}</div>
            <div className="text-text-secondary/60">{targetKey}</div>
          </div>
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
