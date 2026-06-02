import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onconfirm: () => void;
  oncancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onconfirm,
  oncancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/50"
        onClick={oncancel}
        aria-label="Close dialog"
      />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-96 p-6 space-y-4 z-10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            <p className="text-sm text-text-muted mt-1 whitespace-pre-line">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            className="px-4 py-2 text-sm text-text-secondary bg-bg-tertiary hover:bg-bg-hover rounded-lg transition-colors"
            onClick={oncancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm text-white bg-danger hover:bg-danger/80 rounded-lg transition-colors"
            onClick={onconfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
