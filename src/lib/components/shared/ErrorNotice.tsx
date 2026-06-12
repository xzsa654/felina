import { useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { t } from "$lib/i18n";
import { useLocaleStore } from "$lib/stores/locale";

interface Props {
  /** Already-localized title resolved by the caller via t(locale, key). */
  title: string;
  /** Verbatim error payload (backend message). Rendered as-is, never translated. */
  detail?: string | null;
  onDismiss?: () => void;
  className?: string;
}

const COLLAPSED_MAX_HEIGHT = 96;

export default function ErrorNotice({ title, detail, onDismiss, className }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const detailRef = useRef<HTMLPreElement>(null);

  const trimmedDetail = detail?.trim() ? detail : null;

  useLayoutEffect(() => {
    const el = detailRef.current;
    if (!el) {
      setOverflows(false);
      return;
    }
    setOverflows(el.scrollHeight > COLLAPSED_MAX_HEIGHT);
  }, [trimmedDetail]);

  return (
    <div
      role="alert"
      className={`rounded-md border border-danger/30 bg-danger-dim px-4 py-3 ${className ?? ""}`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
        <p className="flex-1 text-sm font-medium text-danger">{title}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t(locale, "common.close")}
            className="shrink-0 rounded p-0.5 text-danger/70 transition-colors hover:text-danger"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {trimmedDetail && (
        <div className="mt-2 pl-6">
          <pre
            ref={detailRef}
            className="select-text overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-text-secondary"
            style={expanded ? undefined : { maxHeight: COLLAPSED_MAX_HEIGHT, overflowY: "hidden" }}
          >
            {trimmedDetail}
          </pre>
          {overflows && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-danger/80 transition-colors hover:text-danger"
            >
              {t(locale, expanded ? "common.errorNotice.collapse" : "common.errorNotice.expand")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
