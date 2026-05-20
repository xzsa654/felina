import { RefreshCw } from "lucide-react";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";

export default function RefreshButton({
  loading,
  onClick,
  locale,
}: {
  loading: boolean;
  onClick: () => void;
  locale: Locale;
}) {
  return (
    <button
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-bg-hover rounded-md transition-colors"
      onClick={onClick}
      disabled={loading}
    >
      <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
      {t(locale, "tokens.refresh")}
    </button>
  );
}
