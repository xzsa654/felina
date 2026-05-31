import type { ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  content: ReactNode;
  onClose: () => void;
}

export default function InfoDialog({ open, title, content, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative z-10 flex max-h-[80vh] w-[36rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-bg-secondary shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 text-sm text-text-primary leading-relaxed">
          {content}
        </div>
      </div>
    </div>
  );
}
