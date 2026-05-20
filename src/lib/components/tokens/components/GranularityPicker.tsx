import type { TimeGranularity } from "$lib/types";
import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";

export default function GranularityPicker({
  value,
  onChange,
  locale,
}: {
  value: TimeGranularity;
  onChange: (g: TimeGranularity) => void;
  locale: Locale;
}) {
  const OPTIONS: { value: TimeGranularity; key: string }[] = [
    { value: "hourly", key: "hourly" },
    { value: "daily", key: "daily" },
    { value: "weekly", key: "weekly" },
    { value: "monthly", key: "monthly" },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-bg-tertiary rounded-md p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`px-2.5 py-1 text-xs font-medium rounded ${
            value === opt.value
              ? "bg-bg-secondary text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
          onClick={() => onChange(opt.value)}
        >
          {t(locale, `tokens.granularity.${opt.key}` as never)}
        </button>
      ))}
    </div>
  );
}
