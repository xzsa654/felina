import type { Locale } from "$lib/i18n";
import { t } from "$lib/i18n";

export default function DateRangeFilter({
  value,
  onChange,
  locale,
}: {
  value: number | null;
  onChange: (days: number | null) => void;
  locale: Locale;
}) {
  const PRESETS: { key: string; days: number | null }[] = [
    { key: "all", days: null },
    { key: "days7", days: 7 },
    { key: "days30", days: 30 },
    { key: "days90", days: 90 },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-bg-tertiary rounded-md p-0.5">
      {PRESETS.map((preset) => (
        <button
          key={preset.key}
          className={`px-2.5 py-1 text-xs font-medium rounded ${
            value === preset.days
              ? "bg-bg-secondary text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
          onClick={() => onChange(preset.days)}
        >
          {t(locale, `tokens.dateRange.${preset.key}` as never)}
        </button>
      ))}
    </div>
  );
}
